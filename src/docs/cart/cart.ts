
import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

import {
  addCartItemSchema,
  updateCartItemSchema,
} from "../../modules/cart/validators/cart.validator.js";

const cartItemResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const cartResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  items: z.array(cartItemResponseSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const cartItemIdParamsSchema = z.object({
  itemId: z.string().min(1, "Cart item ID is required"),
});

registry.registerPath({
  method: "get",
  path: "/api/v1/cart",
  tags: ["Cart"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Cart retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: cartResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/cart/items",
  tags: ["Cart"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: addCartItemSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Item added to cart successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: cartResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/cart/items/{itemId}",
  tags: ["Cart"],
  security: [{ bearerAuth: [] }],
  request: {
    params: cartItemIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: updateCartItemSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Cart item quantity updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: cartResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/cart/items/{itemId}",
  tags: ["Cart"],
  security: [{ bearerAuth: [] }],
  request: {
    params: cartItemIdParamsSchema,
  },
  responses: {
    200: {
      description: "Cart item removed successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: cartResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/cart",
  tags: ["Cart"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Cart cleared successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: cartResponseSchema,
          }),
        },
      },
    },
  },
});
