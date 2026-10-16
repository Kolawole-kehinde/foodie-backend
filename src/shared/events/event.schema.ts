
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { z } from "zod";

import { EVENT_TYPES } from "./event.types.js";

const baseEventSchema = z.object({
  eventId: z.string().min(1),
  eventType: z.string().min(1),
  occurredAt: z.string().datetime(),
  aggregateType: z.enum(["order", "payment", "identity"]),
  aggregateId: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
});

// Order schemas

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

// Payment schema

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

// Identity schemas

const identityEmailVerificationRequestedDataSchema = z.object({
  email: z.string().email(),
  verificationOtp: z.string().min(1),
});


const identityEmailVerificationResentDataSchema = z.object({
  email: z.string().email(),
  verificationOtp: z.string().min(1),
});

const identityEmailVerifiedDataSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
});

const identityPasswordResetRequestedDataSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  resetUrl: z.string().url(),
});

const identityPasswordResetCompletedDataSchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
});

export const domainEventSchema = z.discriminatedUnion("eventType", [
  // Order events

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

  // Payment events

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

  // Identity events

  baseEventSchema.extend({
    eventType: z.literal(
      EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_REQUESTED,
    ),
    aggregateType: z.literal("identity"),
    data: identityEmailVerificationRequestedDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(
      EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_RESENT,
    ),
    aggregateType: z.literal("identity"),
    data: identityEmailVerificationResentDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.IDENTITY_EMAIL_VERIFIED),
    aggregateType: z.literal("identity"),
    data: identityEmailVerifiedDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.IDENTITY_PASSWORD_RESET_REQUESTED),
    aggregateType: z.literal("identity"),
    data: identityPasswordResetRequestedDataSchema,
  }),

  baseEventSchema.extend({
    eventType: z.literal(EVENT_TYPES.IDENTITY_PASSWORD_RESET_COMPLETED),
    aggregateType: z.literal("identity"),
    data: identityPasswordResetCompletedDataSchema,
  }),
]);
