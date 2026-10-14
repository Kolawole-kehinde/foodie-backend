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

  IDENTITY_EMAIL_VERIFICATION_REQUESTED: "identity.email_verification_requested.v1",
  IDENTITY_EMAIL_VERIFICATION_RESENT: "identity.email_verification_resent.v1",
  IDENTITY_EMAIL_VERIFIED: "identity.email_verified.v1",
  IDENTITY_PASSWORD_RESET_REQUESTED: "identity.password_reset_requested.v1",
  IDENTITY_PASSWORD_RESET_COMPLETED: "identity.password_reset_completed.v1",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

export type AggregateType = "order" | "payment" | "identity";

// Order event data

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

// Payment event data

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

// Identity event data

export type IdentityEmailVerificationRequestedEventData = {
  email: string;
};

export type IdentityEmailVerificationResentEventData = {
  email: string;
};

export type IdentityEmailVerifiedEventData = {
  userId: string;
  email: string;
};

export type IdentityPasswordResetRequestedEventData = {
  userId: string;
  email: string;
};

export type IdentityPasswordResetCompletedEventData = {
  userId: string;
  email: string;
};

// Base event

export type BaseEvent< TEventType extends EventType, TData, TAggregateType extends AggregateType = AggregateType> = {
  eventId: string;
  eventType: TEventType;
  occurredAt: string;
  aggregateType: TAggregateType;
  aggregateId: string;
  data: TData;
};

// Order events
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

export type OrderEvent =
  | OrderCreatedEvent
  | OrderCancelledEvent
  | OrderExpiredEvent
  | OrderConfirmedEvent
  | OrderProcessingEvent
  | OrderShippedEvent
  | OrderDeliveredEvent;

// Payment events

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

export type PaymentEvent =
  | PaymentProcessingEvent
  | PaymentSucceededEvent
  | PaymentFailedEvent
  | PaymentCancelledEvent
  | PaymentExpiredEvent
  | PaymentPartiallyRefundedEvent
  | PaymentRefundedEvent;

// Identity events

export type IdentityEmailVerificationRequestedEvent = BaseEvent<
  typeof EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_REQUESTED,
  IdentityEmailVerificationRequestedEventData,
  "identity"
>;

export type IdentityEmailVerificationResentEvent = BaseEvent<
  typeof EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_RESENT,
  IdentityEmailVerificationResentEventData,
  "identity"
>;

export type IdentityEmailVerifiedEvent = BaseEvent<
  typeof EVENT_TYPES.IDENTITY_EMAIL_VERIFIED,
  IdentityEmailVerifiedEventData,
  "identity"
>;

export type IdentityPasswordResetRequestedEvent = BaseEvent<
  typeof EVENT_TYPES.IDENTITY_PASSWORD_RESET_REQUESTED,
  IdentityPasswordResetRequestedEventData,
  "identity"
>;

export type IdentityPasswordResetCompletedEvent = BaseEvent<
  typeof EVENT_TYPES.IDENTITY_PASSWORD_RESET_COMPLETED,
  IdentityPasswordResetCompletedEventData,
  "identity"
>;

export type IdentityEvent =
  | IdentityEmailVerificationRequestedEvent
  | IdentityEmailVerificationResentEvent
  | IdentityEmailVerifiedEvent
  | IdentityPasswordResetRequestedEvent
  | IdentityPasswordResetCompletedEvent;

// All domain events

export type DomainEvent = OrderEvent | PaymentEvent | IdentityEvent;
