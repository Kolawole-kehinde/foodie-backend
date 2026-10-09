import { NotificationStatus, NotificationType, Prisma } from "@prisma/client";

import type { PaymentSucceededEvent } from "../../../shared/events/event.types.js";
import type { NotificationService } from "../services/notification.service.js";

type PaymentSucceededNotificationHandlerDependencies = {
  notificationService: NotificationService;
};

export const createPaymentSucceededNotificationHandler = ({
  notificationService,
}: PaymentSucceededNotificationHandlerDependencies) => {
    
  const handle = async (event: PaymentSucceededEvent) => {
    const { userId, paymentId, orderId, amount, currency } = event.data;

    try {
      await notificationService.create({
        user: {
          connect: { id: userId },
        },
        type: NotificationType.PAYMENT_SUCCESS,
        status: NotificationStatus.UNREAD,
        title: "Payment successful",
        message: `Your payment of ${currency} ${amount} for order ${orderId} was successful.`,
        eventId: event.eventId,
        eventType: event.eventType,
        metadata: {
          paymentId,
          orderId,
          amount,
          currency,
        },
      });
    } catch (error) {
      // Ignore duplicate notifications for the same event, user, and type.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.info(
          `[Notification] Duplicate payment-success notification skipped: ${event.eventId}`,
        );
        return;
      }

      // Allow genuine failures to propagate so the event can be retried.
      throw error;
    }
  };

  return { handle };
};

export type PaymentSucceededNotificationHandler = ReturnType<
  typeof createPaymentSucceededNotificationHandler
>;
