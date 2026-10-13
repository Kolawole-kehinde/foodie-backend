
import {
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";

import {
  EVENT_TYPES,
  type PaymentEvent,
} from "../../../shared/events/event.types.js";

import type { NotificationService } from "../services/notification.service.js";
import { paymentNotificationTemplate } from "../templates/payment-notification.template.js";

type PaymentNotificationHandlerDependencies = {
  notificationService: NotificationService;
  clientUrl?: string;
};

const notificationTypeByEvent = {
  [EVENT_TYPES.PAYMENT_PROCESSING]: NotificationType.PAYMENT_PROCESSING,
  [EVENT_TYPES.PAYMENT_SUCCEEDED]: NotificationType.PAYMENT_SUCCESS,
  [EVENT_TYPES.PAYMENT_FAILED]: NotificationType.PAYMENT_FAILED,
  [EVENT_TYPES.PAYMENT_CANCELLED]: NotificationType.PAYMENT_CANCELLED,
  [EVENT_TYPES.PAYMENT_EXPIRED]: NotificationType.PAYMENT_EXPIRED,
  [EVENT_TYPES.PAYMENT_PARTIALLY_REFUNDED]:
    NotificationType.PAYMENT_PARTIALLY_REFUNDED,
  [EVENT_TYPES.PAYMENT_REFUNDED]: NotificationType.PAYMENT_REFUNDED,
} satisfies Record<PaymentEvent["eventType"], NotificationType>;

export const createPaymentNotificationHandler = ({
  notificationService,
  clientUrl,
}: PaymentNotificationHandlerDependencies) => {
  const handle = async (event: PaymentEvent) => {
    const template = paymentNotificationTemplate(event, { clientUrl });

    try {
      await notificationService.create({
        userId: event.data.userId,
        type: notificationTypeByEvent[event.eventType],
        status: NotificationStatus.UNREAD,
        title: template.inApp.title,
        message: template.inApp.message,
        eventId: event.eventId,
        eventType: event.eventType,
        metadata: {
          paymentId: event.data.paymentId,
          orderId: event.data.orderId,
          amount: event.data.amount,
          currency: event.data.currency,
          provider: event.data.provider,
          providerReference: event.data.providerReference ?? null,
          email: template.email,
        } as Prisma.InputJsonValue,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.info(
          `[Notification] Duplicate payment notification skipped: ${event.eventId}`,
        );
        return;
      }

      throw error;
    }
  };

  return { handle };
};

export type PaymentNotificationHandler = ReturnType<
  typeof createPaymentNotificationHandler
>;
