import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

import {
  initializeInventorySchema,
  addStockSchema,
  removeStockSchema,
} from "../../modules/inventory/validators/inventory.validator.js";

const inventoryResponseSchema = z.object({
  id: z.string(),
  productId: z.string(),
  quantity: z.number(),
  reservedQuantity: z.number(),
  lowStockThreshold: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const inventoryMovementResponseSchema = z.object({
  id: z.string(),
  inventoryId: z.string(),
  type: z.string(),
  quantity: z.number(),
  reason: z.string().nullable(),
  referenceId: z.string().nullable(),
  createdAt: z.string(),
});

const inventoryIdParamsSchema = z.object({
  id: z.string().min(1, "Inventory ID is required"),
});

const productIdParamsSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

registry.registerPath({
  method: "post",
  path: "/api/v1/inventory",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: initializeInventorySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Inventory initialized successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: inventoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/inventory/product/{productId}",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: productIdParamsSchema,
  },
  responses: {
    200: {
      description: "Inventory retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: inventoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/inventory/{id}",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: inventoryIdParamsSchema,
  },
  responses: {
    200: {
      description: "Inventory retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: inventoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/inventory/product/{productId}/stock-in",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: productIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: addStockSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Stock added successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: inventoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/inventory/product/{productId}/stock-out",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: productIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: removeStockSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Stock removed successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: inventoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/inventory/{id}/movements",
  tags: ["Inventory"],
  security: [{ bearerAuth: [] }],
  request: {
    params: inventoryIdParamsSchema,
  },
  responses: {
    200: {
      description: "Inventory movements retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(inventoryMovementResponseSchema),
          }),
        },
      },
    },
  },
});
