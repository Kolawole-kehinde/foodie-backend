
import {
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";

import {
  EVENT_TYPES,
  type OrderEvent,
} from "../../../shared/events/event.types.js";

import type { NotificationService } from "../services/notification.service.js";
import { orderNotificationTemplate } from "../templates/order-notification.template.js";

type OrderNotificationHandlerDependencies = {
  notificationService: NotificationService;
  clientUrl?: string;
};

const notificationTypeByEvent = {
  [EVENT_TYPES.ORDER_CREATED]: NotificationType.ORDER_CREATED,
  [EVENT_TYPES.ORDER_CONFIRMED]: NotificationType.ORDER_CONFIRMED,
  [EVENT_TYPES.ORDER_PROCESSING]: NotificationType.ORDER_PROCESSING,
  [EVENT_TYPES.ORDER_SHIPPED]: NotificationType.ORDER_SHIPPED,
  [EVENT_TYPES.ORDER_DELIVERED]: NotificationType.ORDER_DELIVERED,
  [EVENT_TYPES.ORDER_CANCELLED]: NotificationType.ORDER_CANCELLED,
  [EVENT_TYPES.ORDER_EXPIRED]: NotificationType.ORDER_EXPIRED,
} satisfies Record<OrderEvent["eventType"], NotificationType>;

export const createOrderNotificationHandler = ({
  notificationService,
  clientUrl,
}: OrderNotificationHandlerDependencies) => {
  const handle = async (event: OrderEvent) => {
    const template = orderNotificationTemplate(event, { clientUrl });

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
          orderId: event.data.orderId,
          email: template.email,
        } as Prisma.InputJsonValue,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.info(
          `[Notification] Duplicate order notification skipped: ${event.eventId}`,
        );
        return;
      }

      throw error;
    }
  };

  return { handle };
};

export type OrderNotificationHandler = ReturnType<
  typeof createOrderNotificationHandler
>;
