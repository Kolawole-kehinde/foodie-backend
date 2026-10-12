import {
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";

import type { PaymentSucceededEvent } from "../../../shared/events/event.types.js";
import type { NotificationService } from "../services/notification.service.js";
import { paymentSuccessTemplate } from "../templates/payment-success.template.js";

type PaymentSucceededNotificationHandlerDependencies = {
  notificationService: NotificationService;
  clientUrl?: string;
};

export const createPaymentSucceededNotificationHandler = ({
  notificationService,
  clientUrl,
}: PaymentSucceededNotificationHandlerDependencies) => {
  const handle = async (event: PaymentSucceededEvent) => {
    const { userId, paymentId, orderId, amount, currency } = event.data;

    const template = paymentSuccessTemplate(event.data, { clientUrl });

    try {
      await notificationService.create({
        userId,
        type: NotificationType.PAYMENT_SUCCESS,
        status: NotificationStatus.UNREAD,
        title: template.inApp.title,
        message: template.inApp.message,
        eventId: event.eventId,
        eventType: event.eventType,
        metadata: {
          paymentId,
          orderId,
          amount,
          currency,
          email: template.email,
        } as Prisma.InputJsonValue,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.info(
          `[Notification] Duplicate payment-success notification skipped: ${event.eventId}`,
        );
        return;
      }

      throw error;
    }
  };

  return { handle };
};

export type PaymentSucceededNotificationHandler = ReturnType<
  typeof createPaymentSucceededNotificationHandler
>;