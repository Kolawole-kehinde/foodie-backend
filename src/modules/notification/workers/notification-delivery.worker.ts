import { DeliveryStatus, NotificationChannel } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { createNotificationDeliveryRepository } from "../repositories/notification-delivery.repository.js";
import { createEmailProvider } from "../providers/email/email.provider.js";

type NotificationDeliveryWorkerDependencies = {
  db: DatabaseClient;
};

export const createNotificationDeliveryWorker = ({
  db,
}: NotificationDeliveryWorkerDependencies) => {
  const deliveryRepository = createNotificationDeliveryRepository(db);

  const emailProvider = createEmailProvider();

  const processPendingDeliveries = async (limit = 20) => {
    const deliveries = await deliveryRepository.findPendingDeliveries(limit);

    for (const delivery of deliveries) {
      // Atomically claim a pending delivery so another worker
      // cannot claim the same record at the same time.
      const claim = await db.notificationDelivery.updateMany({
        where: {
          id: delivery.id,
          status: DeliveryStatus.PENDING,
        },
        data: {
          status: DeliveryStatus.PROCESSING,
        },
      });

      if (claim.count !== 1) {
        continue;
      }

      await deliveryRepository.incrementAttempts(delivery.id);

      try {
        if (delivery.channel !== NotificationChannel.EMAIL) {
          throw new Error(
            `Unsupported notification channel: ${delivery.channel}`,
          );
        }

        const result = await emailProvider.send({
          notificationId: delivery.notification.id,
          deliveryId: delivery.id,
          userId: delivery.notification.userId,
          recipientEmail: delivery.notification.user.email,
          title: delivery.notification.title,
          message: delivery.notification.message,
          metadata:
            delivery.notification.metadata &&
            typeof delivery.notification.metadata === "object" &&
            !Array.isArray(delivery.notification.metadata)
              ? (delivery.notification.metadata as Record<string, unknown>)
              : null,
        });

        await deliveryRepository.updateDeliveryStatus(delivery.id, {
          status: DeliveryStatus.SENT,
          providerMessageId: result.providerMessageId,
          deliveredAt: new Date(),
          failureReason: null,
        });
      } catch (error) {
        const failureReason =
          error instanceof Error
            ? error.message
            : "Unknown email delivery error";

        await deliveryRepository.updateDeliveryStatus(delivery.id, {
          status: DeliveryStatus.FAILED,
          failureReason,
        });
      }
    }

    return {
      processed: deliveries.length,
    };
  };

  return {
    processPendingDeliveries,
  };
};

export type NotificationDeliveryWorker = ReturnType<
  typeof createNotificationDeliveryWorker
>;
