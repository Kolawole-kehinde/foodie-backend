import { DeliveryStatus, NotificationChannel } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { createNotificationDeliveryRepository } from "../repositories/notification-delivery.repository.js";
import { createEmailProvider } from "../providers/email/email.provider.js";
import { logger } from "../../../config/logger.js";

type NotificationDeliveryWorkerDependencies = {
  db: DatabaseClient;
};

const getRetryDelayMs = (attempts: number) => {
  const delayMs = 60_000 * 2 ** Math.max(0, attempts - 1);

  // Cap exponential backoff at one hour.
  return Math.min(delayMs, 60 * 60 * 1000);
};

export const createNotificationDeliveryWorker = ({
  db,
}: NotificationDeliveryWorkerDependencies) => {
  const deliveryRepository = createNotificationDeliveryRepository(db);
  const emailProvider = createEmailProvider();

  const processPendingDeliveries = async (limit = 20) => {
    const deliveries = await deliveryRepository.findPendingDeliveries(limit);

    let processed = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const delivery of deliveries) {
      // Claim only if this delivery is still eligible.
      // The repository query may have returned a stale snapshot.
      const now = new Date();

      const claim = await db.notificationDelivery.updateMany({
        where: {
          id: delivery.id,
          channel: NotificationChannel.EMAIL,
          attempts: {
            lt: delivery.maxAttempts,
          },
          OR: [
            {
              status: DeliveryStatus.PENDING,
            },
            {
              status: DeliveryStatus.FAILED,
              nextRetryAt: {
                lte: now,
              },
            },
          ],
        },
        data: {
          status: DeliveryStatus.PROCESSING,
          nextRetryAt: null,
          failureReason: null,
        },
      });

      if (claim.count !== 1) {
        skipped++;
        continue;
      }

      // Attempts are incremented before calling the provider.
      // This counts a send attempt even if the provider throws.
      const attemptedDelivery = await deliveryRepository.incrementAttempts(
        delivery.id,
      );

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

        await deliveryRepository.updateDeliveryStatus(delivery.id, {
          status: DeliveryStatus.SENT,
          providerMessageId: result.providerMessageId,
          deliveredAt: new Date(),
          failureReason: null,
          nextRetryAt: null,
        });

        sent++;
      } catch (error) {
        const failureReason =
          error instanceof Error
            ? error.message
            : "Unknown email delivery error";

        const canRetry =
          attemptedDelivery.attempts < attemptedDelivery.maxAttempts;

        const nextRetryAt = canRetry
          ? new Date(Date.now() + getRetryDelayMs(attemptedDelivery.attempts))
          : null;

        await deliveryRepository.updateDeliveryStatus(delivery.id, {
          status: DeliveryStatus.FAILED,
          failureReason,
          nextRetryAt,
        });

        failed++;
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
