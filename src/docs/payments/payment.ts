import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

import { initializePaymentSchema } from "../../modules/payments/dto/payment.dto.js";
import { createPaymentRefundSchema } from "../../modules/payments/dto/payment-refund.dto.js";

const paymentStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

const paymentProviderSchema = z.enum([
  "PAYSTACK",
  "FLUTTERWAVE",
]);

const paymentAttemptStatusSchema = z.enum([
  "INITIATED",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
]);

const refundStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
]);

const paymentIdParamsSchema = z.object({
  paymentId: z.string().min(1, "Payment ID is required"),
});

const providerParamsSchema = z.object({
  provider: paymentProviderSchema,
});

const paymentAttemptResponseSchema = z.object({
  id: z.string(),
  paymentId: z.string(),
  provider: paymentProviderSchema,
  providerReference: z.string().nullable(),
  amount: z.string(),
  currency: z.string(),
  status: paymentAttemptStatusSchema,
  failureReason: z.string().nullable(),
  initiatedAt: z.string(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const paymentResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  userId: z.string(),
  amount: z.string(),
  currency: z.string(),
  status: paymentStatusSchema,
  provider: paymentProviderSchema,
  providerReference: z.string().nullable(),
  paidAt: z.string().nullable(),
  failedAt: z.string().nullable(),
  refundedAt: z.string().nullable(),
  failureReason: z.string().nullable(),
  attempts: z.array(paymentAttemptResponseSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const initializePaymentResponseSchema = z.object({
  paymentId: z.string(),
  attemptId: z.string(),
  provider: paymentProviderSchema,
  providerReference: z.string(),
  authorizationUrl: z.string().nullable().optional(),
  status: paymentStatusSchema,
});

const refundResponseSchema = z.object({
  id: z.string(),
  paymentId: z.string(),
  amount: z.string(),
  currency: z.string(),
  providerReference: z.string().nullable(),
  status: refundStatusSchema,
  reason: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * Initialize payment
 */
registry.registerPath({
  method: "post",
  path: "/api/v1/payments",
  tags: ["Payments"],
  security: [{ bearerAuth: [] }],

request: {
  headers: z.object({
    "Idempotency-Key": z.string().min(1),
  }),

  body: {
    content: {
      "application/json": {
        schema: initializePaymentSchema,
      },
    },
  },
},

  responses: {
    201: {
      description: "Payment initialized successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: initializePaymentResponseSchema,
          }),
        },
      },
    },
  },
});

/**
 * Payment webhook
 */
registry.registerPath({
  method: "post",
  path: "/api/v1/payments/webhook/{provider}",
  tags: ["Payments"],

  request: {
    params: providerParamsSchema,

    headers: z.object({
      "x-paystack-signature": z.string(),
    }),

    body: {
      content: {
        "application/json": {
          schema: z.record(z.string(), z.unknown()),
        },
      },
    },
  },

  responses: {
    200: {
      description: "Payment webhook processed successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              duplicate: z.boolean(),
              processed: z.boolean(),
              eventId: z.string(),
              paymentId: z.string().optional(),
              status: paymentStatusSchema.optional(),
              ignored: z.boolean().optional(),
              reason: z.string().optional(),
            }),
          }),
        },
      },
    },
  },
});

/**
 * Get payment
 */
registry.registerPath({
  method: "get",
  path: "/api/v1/payments/{paymentId}",
  tags: ["Payments"],
  security: [{ bearerAuth: [] }],

  request: {
    params: paymentIdParamsSchema,
  },

  responses: {
    200: {
      description: "Payment retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: paymentResponseSchema,
          }),
        },
      },
    },
  },
});

/**
 * Verify payment
 */
registry.registerPath({
  method: "post",
  path: "/api/v1/payments/{paymentId}/verify",
  tags: ["Payments"],
  security: [{ bearerAuth: [] }],

  request: {
    params: paymentIdParamsSchema,
  },

  responses: {
    200: {
      description: "Payment verified successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.object({
              paymentId: z.string(),
              previousStatus: paymentStatusSchema,
              status: paymentStatusSchema,
              changed: z.boolean(),
            }),
          }),
        },
      },
    },
  },
});

/**
 * Refund payment
 */
registry.registerPath({
  method: "post",
  path: "/api/v1/payments/{paymentId}/refund",
  tags: ["Payments"],
  security: [{ bearerAuth: [] }],

  request: {
    params: paymentIdParamsSchema,

    body: {
      content: {
        "application/json": {
          schema: createPaymentRefundSchema,
        },
      },
    },
  },

  responses: {
    201: {
      description: "Payment refund initiated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: refundResponseSchema,
          }),
        },
      },
    },
  },
});

/**
 * Get payment refunds
 */
registry.registerPath({
  method: "get",
  path: "/api/v1/payments/{paymentId}/refunds",
  tags: ["Payments"],
  security: [{ bearerAuth: [] }],

  request: {
    params: paymentIdParamsSchema,
  },

  responses: {
    200: {
      description: "Payment refunds retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(refundResponseSchema),
          }),
        },
      },
    },
  },
});