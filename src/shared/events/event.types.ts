export const EVENT_TYPES = {
  ORDER_CREATED: "order.created.v1",
  ORDER_CANCELLED: "order.cancelled.v1",
  ORDER_EXPIRED: "order.expired.v1",
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];

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

export type OrderEventData =
  | OrderCreatedEventData
  | OrderCancelledEventData
  | OrderExpiredEventData;