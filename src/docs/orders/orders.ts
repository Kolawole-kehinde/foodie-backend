import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

import {
  buyNowSchema,
  checkoutSchema,
} from "../../modules/order/validators/validator.order.js";

const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "EXPIRED",
]);

const shippingAddressResponseSchema = z.object({
  id: z.string(),
  orderId: z.string(),
  recipientName: z.string(),
  phone: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().nullable(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string().nullable(),
  country: z.string(),
  createdAt: z.string(),
});

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
  shippingFee: z.string(),
  reservationExpiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const orderWithItemsResponseSchema = orderResponseSchema.extend({
  items: z.array(orderItemResponseSchema),
  shippingAddress: shippingAddressResponseSchema.nullable(),
});

const orderIdParamsSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orders",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: checkoutSchema,
        },
      },
    },
  },
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
            data: orderWithItemsResponseSchema,
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
            data: orderWithItemsResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/orders/{orderId}/confirm",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      description: "Order confirmed successfully",
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
  path: "/api/v1/orders/{orderId}/process",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      description: "Order processing started successfully",
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
  path: "/api/v1/orders/{orderId}/ship",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      description: "Order shipped successfully",
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
  path: "/api/v1/orders/{orderId}/deliver",
  tags: ["Orders"],
  security: [{ bearerAuth: [] }],
  request: {
    params: orderIdParamsSchema,
  },
  responses: {
    200: {
      description: "Order delivered successfully",
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