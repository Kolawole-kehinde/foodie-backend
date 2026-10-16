
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type {
  DomainEvent,
  OrderEvent,
  PaymentEvent,
} from "../../../shared/events/event.types.js";

export const SUPPORTED_NOTIFICATION_EVENT_TYPES = [
  EVENT_TYPES.PAYMENT_PROCESSING,
  EVENT_TYPES.PAYMENT_SUCCEEDED,
  EVENT_TYPES.PAYMENT_FAILED,
  EVENT_TYPES.PAYMENT_CANCELLED,
  EVENT_TYPES.PAYMENT_EXPIRED,
  EVENT_TYPES.PAYMENT_PARTIALLY_REFUNDED,
  EVENT_TYPES.PAYMENT_REFUNDED,

  EVENT_TYPES.ORDER_CREATED,
  EVENT_TYPES.ORDER_CONFIRMED,
  EVENT_TYPES.ORDER_PROCESSING,
  EVENT_TYPES.ORDER_SHIPPED,
  EVENT_TYPES.ORDER_DELIVERED,
  EVENT_TYPES.ORDER_CANCELLED,
  EVENT_TYPES.ORDER_EXPIRED,


] as const;



export type SupportedNotificationEvent =
  | OrderEvent
  | PaymentEvent

const supportedEventTypes: ReadonlySet<string> = new Set(
  SUPPORTED_NOTIFICATION_EVENT_TYPES,
);

export const isSupportedNotificationEvent = (
  event: DomainEvent,
): event is SupportedNotificationEvent => {
  return supportedEventTypes.has(event.eventType);
};