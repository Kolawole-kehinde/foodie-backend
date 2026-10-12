
import { randomUUID } from "node:crypto";
import { NotificationChannel } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { logger } from "../../../config/logger.js";
import { createNotificationDeliveryRepository } from "../repositories/notification-delivery.repository.js";
import { createEmailProvider } from "../providers/email/email.provider.js";
import { EmailProviderError } from "../providers/email/email-provider.error.js";

type NotificationDeliveryWorkerDependencies = {
  db: DatabaseClient;
};

const LEASE_MS = 60_000;
const LEASE_RENEWAL_INTERVAL_MS = 20_000;

// Calculate exponential backoff with jitter, capped at one hour
// before jitter is added.
const getRetryDelayMs = (attempts: number) => {
  const baseDelayMs = 60_000 * 2 ** Math.max(0, attempts - 1);
  const cappedDelayMs = Math.min(baseDelayMs, 60 * 60 * 1000);

  const jitterMs = Math.floor(
    Math.random() * Math.min(cappedDelayMs * 0.2, 30_000),
  );

  return cappedDelayMs + jitterMs;
};

export const createNotificationDeliveryWorker = ({
  db,
}: NotificationDeliveryWorkerDependencies) => {
  const deliveryRepository = createNotificationDeliveryRepository(db);
  const emailProvider = createEmailProvider();

  // Give every worker instance a unique identity.
  const workerId = `notification-worker-${randomUUID()}`;

  // Keep extending the lease while the provider request is running.
  const startLeaseHeartbeat = (deliveryId: string) => {
    let leaseLost = false;
    let renewalInFlight: Promise<void> | undefined;

    const timer = setInterval(() => {
      // Avoid overlapping database renewals.
      if (renewalInFlight) return;

      renewalInFlight = (async () => {
        try {
          const result = await deliveryRepository.renewLease(
            deliveryId,
            workerId,
            LEASE_MS,
          );

          if (result.count !== 1) {
            leaseLost = true;

            logger.warn(
              { deliveryId, workerId },
              "Notification delivery lease is no longer owned by this worker",
            );
          }
        } catch (error) {
          // Ownership is uncertain, so do not finalize this delivery.
          leaseLost = true;

          logger.error(
            { err: error, deliveryId, workerId },
            "Failed to renew notification delivery lease",
          );
        }
      })().finally(() => {
        renewalInFlight = undefined;
      });
    }, LEASE_RENEWAL_INTERVAL_MS);

    return {
      isLeaseLost: () => leaseLost,

      stop: async () => {
        clearInterval(timer);

        // Wait for any outstanding renewal before finalization.
        await renewalInFlight;
      },
    };
  };

  const processPendingDeliveries = async (limit = 20) => {
    // Claim deliveries atomically before making provider calls.
    const deliveries = await deliveryRepository.claimPendingDeliveries({
      workerId,
      limit,
      leaseMs: LEASE_MS,
    });

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const delivery of deliveries) {
      processed++;

      // The current claim query selects EMAIL deliveries only.
      if (delivery.channel !== NotificationChannel.EMAIL) {
        skipped++;
        continue;
      }

      const heartbeat = startLeaseHeartbeat(delivery.id);

      const metadata =
        delivery.notification.metadata &&
        typeof delivery.notification.metadata === "object" &&
        !Array.isArray(delivery.notification.metadata)
          ? (delivery.notification.metadata as Record<string, unknown>)
          : null;

      let providerMessageId: string;

      try {
        // Perform network I/O outside database transactions.
        const result = await emailProvider.send({
          notificationId: delivery.notification.id,
          deliveryId: delivery.id,
          userId: delivery.notification.userId,
          recipientEmail: delivery.notification.user.email,
          title: delivery.notification.title,
          message: delivery.notification.message,
          metadata,
        });

        // A missing provider ID makes the outcome uncertain. Retry
        // conservatively because the provider may have accepted the email.
        if (!result.providerMessageId) {
          throw new EmailProviderError(
            "Email provider did not return a provider message ID",
            true,
            "MISSING_PROVIDER_MESSAGE_ID",
          );
        }

        providerMessageId = result.providerMessageId;
      } catch (error) {
        await heartbeat.stop();

        const failureReason =
          error instanceof Error
            ? error.message
            : "Unknown email delivery error";

        // Do not update a delivery after losing lease ownership.
        if (heartbeat.isLeaseLost()) {
          skipped++;

          logger.warn(
            { deliveryId: delivery.id, workerId, failureReason },
            "Email provider failed after this worker lost its lease",
          );

          continue;
        }

        // Attempts are incremented when the delivery is claimed.
        // Unknown errors default to retryable, with retries bounded
        // by the delivery's configured maximum attempt count.
        const providerError =
          error instanceof EmailProviderError ? error : null;

        const retryable = providerError?.retryable ?? true;
        const canRetry =
          retryable && delivery.attempts < delivery.maxAttempts;

        const nextRetryAt = canRetry
          ? new Date(
              Date.now() + getRetryDelayMs(delivery.attempts),
            )
          : null;

        // The repository checks worker ownership and lease validity.
        // Permanent errors are marked as dead-lettered immediately.
        const update = await deliveryRepository.markFailedIfOwned(
          delivery.id,
          workerId,
          failureReason,
          nextRetryAt,
          !retryable,
        );

        if (update.count === 1) {
          failed++;

          logger.error(
            {
              deliveryId: delivery.id,
              attempts: delivery.attempts,
              maxAttempts: delivery.maxAttempts,
              retryable,
              nextRetryAt,
              failureReason,
              providerCode: providerError?.providerCode,
              responseCode: providerError?.responseCode,
            },
            canRetry
              ? "Notification delivery failed; retry scheduled"
              : !retryable
                ? "Notification delivery failed permanently; moved to DLQ"
                : "Notification delivery failed; attempts exhausted",
          );
        } else {
          skipped++;

          logger.warn(
            { deliveryId: delivery.id, workerId },
            "Could not record failure because this worker no longer owns a valid lease",
          );
        }

        continue;
      }

      await heartbeat.stop();

      // The provider may have accepted the email, but another worker
      // may now own the delivery. Never finalize without a valid lease.
      if (heartbeat.isLeaseLost()) {
        skipped++;

        logger.warn(
          { deliveryId: delivery.id, workerId, providerMessageId },
          "Email provider accepted the message, but lease ownership was lost before finalization",
        );

        continue;
      }

      const update = await deliveryRepository.markSentIfOwned(
        delivery.id,
        workerId,
        providerMessageId,
      );

      if (update.count === 1) {
        sent++;
      } else {
        skipped++;

        logger.warn(
          { deliveryId: delivery.id, workerId, providerMessageId },
          "Email provider accepted the message, but the delivery could not be finalized by this worker",
        );
      }
    }

    return {
      fetched: deliveries.length,
      processed,
      sent,
      failed,
      skipped,
    };
  };

  const processDeadLetters = async (limit = 20) => {
    // Select exhausted deliveries that have not already entered the DLQ.
    const deliveries =
      await deliveryRepository.findExhaustedDeliveries(limit);

    let deadLettered = 0;
    let skipped = 0;

    for (const delivery of deliveries) {
      const result = await deliveryRepository.markAsDeadLettered(
        delivery.id,
      );

      if (result.count === 1) {
        deadLettered++;

        logger.error(
          {
            deliveryId: delivery.id,
            notificationId: delivery.notificationId,
            attempts: delivery.attempts,
            maxAttempts: delivery.maxAttempts,
            failureReason: delivery.failureReason,
          },
          "Notification delivery moved to DLQ",
        );
      } else {
        // Another worker may already have processed this delivery.
        skipped++;
      }
    }

    return {
      fetched: deliveries.length,
      deadLettered,
      skipped,
    };
  };

  return {
    processPendingDeliveries,
    processDeadLetters,
  };
};

export type NotificationDeliveryWorker = ReturnType<
  typeof createNotificationDeliveryWorker
>;