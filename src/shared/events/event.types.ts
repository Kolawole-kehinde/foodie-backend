import type { OrderStatus, PaymentStatus } from "@prisma/client";

export const EVENT_TYPES = {
  ORDER_CREATED: "order.created.v1",
  ORDER_CANCELLED: "order.cancelled.v1",
  ORDER_EXPIRED: "order.expired.v1",
  ORDER_CONFIRMED: "order.confirmed.v1",
  ORDER_PROCESSING: "order.processing.v1",
  ORDER_SHIPPED: "order.shipped.v1",
  ORDER_DELIVERED: "order.delivered.v1",

  PAYMENT_PROCESSING: "payment.processing.v1",
  PAYMENT_SUCCEEDED: "payment.succeeded.v1",
  PAYMENT_FAILED: "payment.failed.v1",
  PAYMENT_CANCELLED: "payment.cancelled.v1",
  PAYMENT_EXPIRED: "payment.expired.v1",
  PAYMENT_PARTIALLY_REFUNDED: "payment.partially_refunded.v1",
  PAYMENT_REFUNDED: "payment.refunded.v1",
} as const;

export type EventType =
  (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export type AggregateType =
  | "order"
  | "payment";

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

export type PaymentEventData = {
  paymentId: string;
  orderId: string;
  userId: string;
  provider: string;
  providerReference?: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
};

export type BaseEvent<
  TEventType extends EventType,
  TData,
  TAggregateType extends AggregateType = AggregateType,
> = {
  eventId: string;
  eventType: TEventType;
  occurredAt: string;
  aggregateType: TAggregateType;
  aggregateId: string;
  data: TData;
};

export type OrderCreatedEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_CREATED,
  OrderCreatedEventData,
  "order"
>;

export type OrderCancelledEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_CANCELLED,
  OrderCancelledEventData,
  "order"
>;

export type OrderExpiredEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_EXPIRED,
  OrderExpiredEventData,
  "order"
>;

export type OrderConfirmedEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_CONFIRMED,
  OrderStatusChangedEventData,
  "order"
>;

export type OrderProcessingEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_PROCESSING,
  OrderStatusChangedEventData,
  "order"
>;

export type OrderShippedEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_SHIPPED,
  OrderStatusChangedEventData,
  "order"
>;

export type OrderDeliveredEvent = BaseEvent<
  typeof EVENT_TYPES.ORDER_DELIVERED,
  OrderStatusChangedEventData,
  "order"
>;

export type PaymentProcessingEvent = BaseEvent<
  typeof EVENT_TYPES.PAYMENT_PROCESSING,
  PaymentEventData,
  "payment"
>;

export type PaymentSucceededEvent = BaseEvent<
  typeof EVENT_TYPES.PAYMENT_SUCCEEDED,
  PaymentEventData,
  "payment"
>;

export type PaymentFailedEvent = BaseEvent<
  typeof EVENT_TYPES.PAYMENT_FAILED,
  PaymentEventData,
  "payment"
>;

export type PaymentCancelledEvent = BaseEvent<
  typeof EVENT_TYPES.PAYMENT_CANCELLED,
  PaymentEventData,
  "payment"
>;

export type PaymentExpiredEvent = BaseEvent<
  typeof EVENT_TYPES.PAYMENT_EXPIRED,
  PaymentEventData,
  "payment"
>;

export type PaymentPartiallyRefundedEvent = BaseEvent<
  typeof EVENT_TYPES.PAYMENT_PARTIALLY_REFUNDED,
  PaymentEventData,
  "payment"
>;

export type PaymentRefundedEvent = BaseEvent<
  typeof EVENT_TYPES.PAYMENT_REFUNDED,
  PaymentEventData,
  "payment"
>;

export type OrderEvent =
  | OrderCreatedEvent
  | OrderCancelledEvent
  | OrderExpiredEvent
  | OrderConfirmedEvent
  | OrderProcessingEvent
  | OrderShippedEvent
  | OrderDeliveredEvent;

export type PaymentEvent =
  | PaymentProcessingEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | PaymentCancelledEvent
  | PaymentExpiredEvent
  | PaymentPartiallyRefundedEvent
  | PaymentRefundedEvent;

export type DomainEvent = OrderEvent | PaymentEvent;