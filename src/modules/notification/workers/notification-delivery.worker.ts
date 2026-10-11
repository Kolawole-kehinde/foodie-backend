import { randomUUID } from "node:crypto";
import { NotificationChannel } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { createNotificationDeliveryRepository } from "../repositories/notification-delivery.repository.js";
import { createEmailProvider } from "../providers/email/email.provider.js";
import { logger } from "../../../config/logger.js";
import { EmailProviderError } from "../providers/email/email-provider.error.js";

type NotificationDeliveryWorkerDependencies = {
  db: DatabaseClient;
};

const LEASE_MS = 60_000;
const LEASE_RENEWAL_INTERVAL_MS = 20_000;

const getRetryDelayMs = (attempts: number) => {
  // Exponential backoff with jitter, capped at one hour before jitter.
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

  // Each running worker instance must have its own identity.
  const workerId = `notification-worker-${randomUUID()}`;

  // Renew the lease while the provider request is in progress.
  const startLeaseHeartbeat = (deliveryId: string) => {
    let leaseLost = false;
    let renewalInFlight: Promise<void> | undefined;

    const timer = setInterval(() => {
      // Avoid overlapping renewals if the database is slow.
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
          // Ownership is now uncertain, so do not finalize this delivery.
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

        // Wait for an outstanding renewal before finalizing the delivery.
        await renewalInFlight;
      },
    };
  };

  const processPendingDeliveries = async (limit = 20) => {
    // The claim commits before any provider call begins.
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

      if (delivery.channel !== NotificationChannel.EMAIL) {
        // The claim query currently selects EMAIL only.
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
        // Network I/O happens outside database transactions.
        const result = await emailProvider.send({
          notificationId: delivery.notification.id,
          deliveryId: delivery.id,
          userId: delivery.notification.userId,
          recipientEmail: delivery.notification.user.email,
          title: delivery.notification.title,
          message: delivery.notification.message,
          metadata,
        });

        if (!result.providerMessageId) {
  throw new Error(
    "Email provider did not return a provider message ID",
  );
}

providerMessageId = result.providerMessageId;
      } catch (error) {
        await heartbeat.stop();

        const failureReason =
          error instanceof Error
            ? error.message
            : "Unknown email delivery error";

        if (heartbeat.isLeaseLost()) {
          skipped++;

          logger.warn(
            { deliveryId: delivery.id, workerId, failureReason },
            "Email provider failed after this worker lost its lease",
          );

          continue;
        }

        // Attempts were incremented when the delivery was claimed.
       

     const providerError =
  error instanceof EmailProviderError ? error : null;

// Only retry when the provider classifies the error as retryable.
// Unknown errors remain retryable, with the maximum attempt limit enforced.
const retryable = providerError?.retryable ?? true;
const canRetry = retryable && delivery.attempts < delivery.maxAttempts;

const nextRetryAt = canRetry
  ? new Date(Date.now() + getRetryDelayMs(delivery.attempts))
  : null;

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
              nextRetryAt,
              failureReason,
            },
            canRetry
              ? "Notification delivery failed; retry scheduled"
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

      if (heartbeat.isLeaseLost()) {
        // The provider may have accepted the email, but this worker can no
        // longer safely update the database. A duplicate on recovery is possible.
        skipped++;

        logger.warn(
          { deliveryId: delivery.id, workerId, providerMessageId },
          "Email provider accepted the message, but lease ownership was lost before finalization",
        );

        continue;
      }

      // A repository-level conditional update verifies current lease ownership.
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
    const deliveries = await deliveryRepository.findExhaustedDeliveries(limit);

    let deadLettered = 0;
    let skipped = 0;

    for (const delivery of deliveries) {
      const result = await deliveryRepository.markAsDeadLettered(delivery.id);

      if (result.count === 1) {
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

        deadLettered++;
      } else {
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
