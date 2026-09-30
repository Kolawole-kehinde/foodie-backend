
import type { OrderStatus } from "@prisma/client";

export const EVENT_TYPES = {
  ORDER_CREATED: "order.created.v1",
  ORDER_CANCELLED: "order.cancelled.v1",
  ORDER_EXPIRED: "order.expired.v1",
  ORDER_CONFIRMED: "order.confirmed.v1",
  ORDER_PROCESSING: "order.processing.v1",
  ORDER_SHIPPED: "order.shipped.v1",
  ORDER_DELIVERED: "order.delivered.v1",
} as const;

export type EventType =
  (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export type AggregateType = "order";

export type OrderEventItem = {
  productId: string;
  productName: string;
  unitPrice: string;
  quantity: number;
  subtotal: string;
};

export type OrderCreatedEventData = {
  orderId: string;
  userId: string;
  totalAmount: string;
  items: OrderEventItem[];
};

export type OrderCancelledEventData = {
  orderId: string;
  userId: string;
  totalAmount: string;
};

export type OrderExpiredEventData = {
  orderId: string;
  userId: string;
  totalAmount: string;
};

export type OrderStatusChangedEventData = {
  orderId: string;
  userId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
};

export type BaseEvent<
  TEventType extends EventType,
  TData,
> = {
  eventId: string;
  eventType: TEventType;
  occurredAt: string;
  aggregateType: AggregateType;
  aggregateId: string;
  data: TData;
};

export type OrderCreatedEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_CREATED,
  OrderCreatedEventData
>;

export type OrderCancelledEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_CANCELLED,
  OrderCancelledEventData
>;

export type OrderExpiredEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_EXPIRED,
  OrderExpiredEventData
>;

export type OrderConfirmedEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_CONFIRMED,
  OrderStatusChangedEventData
>;

export type OrderProcessingEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_PROCESSING,
  OrderStatusChangedEventData
>;

export type OrderShippedEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_SHIPPED,
  OrderStatusChangedEventData
>;

export type OrderDeliveredEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_DELIVERED,
  OrderStatusChangedEventData
>;

export type OrderEvent =
  | OrderCreatedEvent
  | OrderCancelledEvent
  | OrderExpiredEvent
  | OrderConfirmedEvent
  | OrderProcessingEvent
  | OrderShippedEvent
  | OrderDeliveredEvent;
