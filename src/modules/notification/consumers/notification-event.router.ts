
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { DomainEvent } from "../../../shared/events/event.types.js";

import type { PaymentSucceededNotificationHandler } from "../handlers/payment-succeeded-notification.handler.js";
import type { OrderNotificationHandler } from "../handlers/order-notification.handler.js";

type NotificationEventRouterDependencies = {
  paymentSucceededHandler: PaymentSucceededNotificationHandler;
  orderHandler: OrderNotificationHandler;
};

export const createNotificationEventRouter = ({
  paymentSucceededHandler,
  orderHandler,
}: NotificationEventRouterDependencies) => {
  const route = async (event: DomainEvent): Promise<boolean> => {
    switch (event.eventType) {
      case EVENT_TYPES.PAYMENT_SUCCEEDED:
        await paymentSucceededHandler.handle(event);
        return true;

      case EVENT_TYPES.ORDER_CREATED:
      case EVENT_TYPES.ORDER_CONFIRMED:
      case EVENT_TYPES.ORDER_PROCESSING:
      case EVENT_TYPES.ORDER_SHIPPED:
      case EVENT_TYPES.ORDER_DELIVERED:
      case EVENT_TYPES.ORDER_CANCELLED:
      case EVENT_TYPES.ORDER_EXPIRED:
        await orderHandler.handle(event);
        return true;

      default:
        console.info("[Notification] Event type not handled", {
          eventId: event.eventId,
          eventType: event.eventType,
        });
        return false;
    }
  };

  return { route };
};

export type NotificationEventRouter = ReturnType<
  typeof createNotificationEventRouter
>;
