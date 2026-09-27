import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

import { buyNowSchema } from "../../modules/order/validators/validator.order.js";

const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "EXPIRED",
]);

const orderItemResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  productId: z.string(),
  productName: z.string(),
  unitPrice: z.string(),
  quantity: z.number(),
  subtotal: z.string(),
  createdAt: z.string(),
});

const orderResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  status: orderStatusSchema,
  totalAmount: z.string(),
  reservationExpiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const orderWithItemsResponseSchema = orderResponseSchema.extend({
  items: z.array(orderItemResponseSchema),
});

const orderIdParamsSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orders",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  responses: {
    201: {
      description: "Order created successfully from cart",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: orderWithItemsResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orders/buy-now",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: buyNowSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Order created successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: orderWithItemsResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orders",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Orders retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(orderResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/orders/{orderId}",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      description: "Order retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: orderResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orders/{orderId}/cancel",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      description: "Order cancelled successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: orderResponseSchema,
          }),
        },
      },
    },
  },
});
