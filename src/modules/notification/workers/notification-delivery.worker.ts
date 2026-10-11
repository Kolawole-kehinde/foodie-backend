import { randomUUID } from "node:crypto";
import { DeliveryStatus, NotificationChannel } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { createNotificationDeliveryRepository } from "../repositories/notification-delivery.repository.js";
import { createEmailProvider } from "../providers/email/email.provider.js";
import { logger } from "../../../config/logger.js";

type NotificationDeliveryWorkerDependencies = {
  db: DatabaseClient;
};

const LEASE_MS = 60_000;

const getRetryDelayMs = (attempts: number) => {
  // Exponential backoff with jitter to avoid retrying every failed job together.
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

  // Each worker instance gets its own identity for lease ownership checks.
  const workerId = `notification-worker-${randomUUID()}`;

  const processPendingDeliveries = async (limit = 20) => {
    // Jobs are atomically claimed and committed before any email is sent.
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

      try {
        if (delivery.channel !== NotificationChannel.EMAIL) {
          throw new Error(
            `Unsupported notification channel: ${delivery.channel}`,
          );
        }

        const metadata =
          delivery.notification.metadata &&
          typeof delivery.notification.metadata === "object" &&
          !Array.isArray(delivery.notification.metadata)
            ? (delivery.notification.metadata as Record<string, unknown>)
            : null;

        const result = await emailProvider.send({
          notificationId: delivery.notification.id,
          deliveryId: delivery.id,
          userId: delivery.notification.userId,
          recipientEmail: delivery.notification.user.email,
          title: delivery.notification.title,
          message: delivery.notification.message,
          metadata,
        });

        // Finalize only if this worker still owns the active lease.
        const update = await db.notificationDelivery.updateMany({
          where: {
            id: delivery.id,
            status: DeliveryStatus.PROCESSING,
            lockedBy: workerId,
          },
          data: {
            status: DeliveryStatus.SENT,
            providerMessageId: result.providerMessageId,
            deliveredAt: new Date(),
            failureReason: null,
            nextRetryAt: null,
            lockedBy: null,
            leaseExpiresAt: null,
          },
        });

        if (update.count === 1) {
          sent++;
        } else {
          // Another worker may have reclaimed the delivery after this lease expired.
          skipped++;
          logger.warn(
            { deliveryId: delivery.id, workerId },
            "Notification delivery succeeded at provider but lease ownership was lost before finalization",
          );
        }
      } catch (error) {
        const failureReason =
          error instanceof Error
            ? error.message
            : "Unknown email delivery error";

        // Do not overwrite the result if another worker has reclaimed this job.
        const currentDelivery = await deliveryRepository.findDelivery(
          delivery.id,
        );

        if (
          !currentDelivery ||
          currentDelivery.status !== DeliveryStatus.PROCESSING ||
          currentDelivery.lockedBy !== workerId
        ) {
          skipped++;
          logger.warn(
            { deliveryId: delivery.id, workerId, failureReason },
            "Notification delivery failed after lease ownership was lost",
          );
          continue;
        }

        const canRetry = currentDelivery.attempts < currentDelivery.maxAttempts;

        const nextRetryAt = canRetry
          ? new Date(Date.now() + getRetryDelayMs(currentDelivery.attempts))
          : null;

        const update = await db.notificationDelivery.updateMany({
          where: {
            id: delivery.id,
            status: DeliveryStatus.PROCESSING,
            lockedBy: workerId,
          },
          data: {
            status: DeliveryStatus.FAILED,
            failureReason,
            nextRetryAt,
            lockedBy: null,
            leaseExpiresAt: null,
          },
        });

        if (update.count === 1) {
          failed++;

          logger.error(
            {
              deliveryId: delivery.id,
              attempts: currentDelivery.attempts,
              maxAttempts: currentDelivery.maxAttempts,
              nextRetryAt,
              failureReason,
            },
            canRetry
              ? "Notification delivery failed; retry scheduled"
              : "Notification delivery failed; attempts exhausted",
          );
        } else {
          skipped++;
        }
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
