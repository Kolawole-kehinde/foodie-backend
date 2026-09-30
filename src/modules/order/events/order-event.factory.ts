
import crypto from "node:crypto";
import type { OrderStatus } from "@prisma/client";

import {
  EVENT_TYPES,
  type OrderCancelledEvent,
  type OrderConfirmedEvent,
  type OrderCreatedEvent,
  type OrderDeliveredEvent,
  type OrderEventItem,
  type OrderExpiredEvent,
  type OrderProcessingEvent,
  type OrderShippedEvent,
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

type CreateOrderStatusChangedEventInput = {
  orderId: string;
  userId: string;
  previousStatus: OrderStatus;
  newStatus: OrderStatus;
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

export const createOrderConfirmedEvent = ({
  orderId,
  userId,
  previousStatus,
  newStatus,
}: CreateOrderStatusChangedEventInput): OrderConfirmedEvent => {
  return {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.ORDER_CONFIRMED,
    occurredAt: new Date().toISOString(),
    aggregateType: "order",
    aggregateId: orderId,
    data: {
      orderId,
      userId,
      previousStatus,
      newStatus,
    },
  };
};

export const createOrderProcessingEvent = ({
  orderId,
  userId,
  previousStatus,
  newStatus,
}: CreateOrderStatusChangedEventInput): OrderProcessingEvent => {
  return {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.ORDER_PROCESSING,
    occurredAt: new Date().toISOString(),
    aggregateType: "order",
    aggregateId: orderId,
    data: {
      orderId,
      userId,
      previousStatus,
      newStatus,
    },
  };
};

export const createOrderShippedEvent = ({
  orderId,
  userId,
  previousStatus,
  newStatus,
}: CreateOrderStatusChangedEventInput): OrderShippedEvent => {
  return {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.ORDER_SHIPPED,
    occurredAt: new Date().toISOString(),
    aggregateType: "order",
    aggregateId: orderId,
    data: {
      orderId,
      userId,
      previousStatus,
      newStatus,
    },
  };
};

export const createOrderDeliveredEvent = ({
  orderId,
  userId,
  previousStatus,
  newStatus,
}: CreateOrderStatusChangedEventInput): OrderDeliveredEvent => {
  return {
    eventId: crypto.randomUUID(),
    eventType: EVENT_TYPES.ORDER_DELIVERED,
    occurredAt: new Date().toISOString(),
    aggregateType: "order",
    aggregateId: orderId,
    data: {
      orderId,
      userId,
      previousStatus,
      newStatus,
    },
  };
};

