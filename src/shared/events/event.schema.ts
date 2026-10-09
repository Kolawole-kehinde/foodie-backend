import { z } from "zod";

import { EVENT_TYPES } from "./event.types.js";
import { OrderStatus, PaymentStatus } from "@prisma/client";

const baseEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.string().datetime(),
  aggregateType: z.enum(["order", "payment"]),
  aggregateId: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

const orderEventItemSchema = z.object({
  productId: z.string().min(1),
  productName: z.string().min(1),
  unitPrice: z.string(),
  quantity: z.number().int().positive(),
  subtotal: z.string(),
});

const orderCreatedDataSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  totalAmount: z.string(),
  items: z.array(orderEventItemSchema),
});

const orderCancelledDataSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  totalAmount: z.string(),
});

const orderExpiredDataSchema = orderCancelledDataSchema;

const orderStatusChangedDataSchema = z.object({
  orderId: z.string().min(1),
  userId: z.string().min(1),
  previousStatus: z.nativeEnum(OrderStatus),
  newStatus: z.nativeEnum(OrderStatus),
});

const paymentDataSchema = z.object({
  paymentId: z.string().min(1),
  orderId: z.string().min(1),
  userId: z.string().min(1),
  provider: z.string().min(1),
  providerReference: z.string().optional(),
  amount: z.string(),
  currency: z.string().min(1),
  status: z.nativeEnum(PaymentStatus),
});

export const domainEventSchema = z.discriminatedUnion("eventType", [
  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.ORDER_CREATED),
    aggregateType: z.literal("order"),
    data: orderCreatedDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.ORDER_CANCELLED),
    aggregateType: z.literal("order"),
    data: orderCancelledDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.ORDER_EXPIRED),
    aggregateType: z.literal("order"),
    data: orderExpiredDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.ORDER_CONFIRMED),
    aggregateType: z.literal("order"),
    data: orderStatusChangedDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.ORDER_PROCESSING),
    aggregateType: z.literal("order"),
    data: orderStatusChangedDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.ORDER_SHIPPED),
    aggregateType: z.literal("order"),
    data: orderStatusChangedDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.ORDER_DELIVERED),
    aggregateType: z.literal("order"),
    data: orderStatusChangedDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.PAYMENT_PROCESSING),
    aggregateType: z.literal("payment"),
    data: paymentDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.PAYMENT_SUCCEEDED),
    aggregateType: z.literal("payment"),
    data: paymentDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.PAYMENT_FAILED),
    aggregateType: z.literal("payment"),
    data: paymentDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.PAYMENT_CANCELLED),
    aggregateType: z.literal("payment"),
    data: paymentDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.PAYMENT_EXPIRED),
    aggregateType: z.literal("payment"),
    data: paymentDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.PAYMENT_PARTIALLY_REFUNDED),
    aggregateType: z.literal("payment"),
    data: paymentDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.PAYMENT_REFUNDED),
    aggregateType: z.literal("payment"),
    data: paymentDataSchema,
  }),
]);
