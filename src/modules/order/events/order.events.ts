import crypto from "node:crypto";

import {
  EVENT_TYPES,
  type OrderCancelledEvent,
  type OrderCreatedEvent,
  type OrderEventItem,
  type OrderExpiredEvent,
} from "../../../shared/events/event.types.js";

type CreateOrderCreatedEventInput = {
  orderId: string;
  userId: string;
  totalAmount: string;
  items: OrderEventItem[];
};

type CreateOrderStatusEventInput = {
  orderId: string;
  userId: string;
  totalAmount: string;
};

export const createOrderCreatedEvent = ({
  orderId,
  userId,
  totalAmount,
  items,
}: CreateOrderCreatedEventInput): OrderCreatedEvent => {
  return {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.ORDER_CREATED,
    occurredAt: new Date().toISOString(),
    aggregateType: "order",
    aggregateId: orderId,
    data: {
      orderId,
      userId,
      totalAmount,
      items,
    },
  };
};

export const createOrderCancelledEvent = ({
  orderId,
  userId,
  totalAmount,
}: CreateOrderStatusEventInput): OrderCancelledEvent => {
  return {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.ORDER_CANCELLED,
    occurredAt: new Date().toISOString(),
    aggregateType: "order",
    aggregateId: orderId,
    data: {
      orderId,
      userId,
      totalAmount,
    },
  };
};

export const createOrderExpiredEvent = ({
  orderId,
  userId,
  totalAmount,
}: CreateOrderStatusEventInput): OrderExpiredEvent => {
  return {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.ORDER_EXPIRED,
    occurredAt: new Date().toISOString(),
    aggregateType: "order",
    aggregateId: orderId,
    data: {
      orderId,
      userId,
      totalAmount,
    },
  };
};
