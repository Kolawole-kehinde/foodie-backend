
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { DomainEvent } from "../../../shared/events/event.types.js";
import type { OrderNotificationHandler } from "../handlers/order-notification.handler.js";
import type { PaymentNotificationHandler } from "../handlers/payment-notification.handler.js";

type NotificationEventRouterDependencies = {
  paymentHandler: PaymentNotificationHandler;
  orderHandler: OrderNotificationHandler;
};

export const createNotificationEventRouter = ({
  paymentHandler,
  orderHandler,
}: NotificationEventRouterDependencies) => {

  const route = async (event: DomainEvent): Promise<boolean> => {
    switch (event.eventType) {
      case EVENT_TYPES.PAYMENT_PROCESSING:
      case EVENT_TYPES.PAYMENT_SUCCEEDED:
      case EVENT_TYPES.PAYMENT_FAILED:
      case EVENT_TYPES.PAYMENT_CANCELLED:
      case EVENT_TYPES.PAYMENT_EXPIRED:
      case EVENT_TYPES.PAYMENT_PARTIALLY_REFUNDED:
      case EVENT_TYPES.PAYMENT_REFUNDED:
        await paymentHandler.handle(event);
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


      case EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_REQUESTED:
      case EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_RESENT:
      case EVENT_TYPES.IDENTITY_EMAIL_VERIFIED:
      case EVENT_TYPES.IDENTITY_PASSWORD_RESET_COMPLETED:
      case EVENT_TYPES.IDENTITY_PASSWORD_RESET_REQUESTED:
        await identityHandler.handle(event);
        return true;
    }
  };

  return { route };
};

export type NotificationEventRouter = ReturnType<typeof createNotificationEventRouter>;
