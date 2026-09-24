import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

import {
  createProductSchema,
  updateProductSchema,
} from "../../modules/catalog/validators/product.validator.js";

import { productQuerySchema } from "../../modules/catalog/validators/product-query.validator.js";

const productResponseSchema = z.object({
  id: z.string(),
  categoryId: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string(),
  price: z.string(),
  imageUrl: z.string().url().nullable(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const paginationResponseSchema = z.object({
  page: z.number(),
  limit: z.number(),
  total: z.number(),
  totalPages: z.number(),
});

const productIdParamsSchema = z.object({
  productId: z.string().cuid("Invalid product ID"),
});

const productSlugParamsSchema = z.object({
  slug: z.string().min(1, "Product slug is required"),
});

/**
 * GET /api/v1/catalog/products
 *
 * Supports category filtering, search, sorting, and pagination.
 */
registry.registerPath({
  method: "get",
  path: "/api/v1/catalog/products",
  tags: ["Catalog - Products"],
  security: [{ bearerAuth: [] }],
  request: {
    query: productQuerySchema,
  },
  responses: {
    200: {
      description: "Products retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(productResponseSchema),
            pagination: paginationResponseSchema,
          }),
        },
      },
    },
  },
});

/**
 * GET /api/v1/catalog/products/{productId}
 */
registry.registerPath({
  method: "get",
  path: "/api/v1/catalog/products/{productId}",
  tags: ["Catalog - Products"],
  security: [{ bearerAuth: [] }],
  request: {
    params: productIdParamsSchema,
  },
  responses: {
    200: {
      description: "Product retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: productResponseSchema,
          }),
        },
      },
    },
  },
});

/**
 * GET /api/v1/catalog/products/slug/{slug}
 */
registry.registerPath({
  method: "get",
  path: "/api/v1/catalog/products/slug/{slug}",
  tags: ["Catalog - Products"],
  security: [{ bearerAuth: [] }],
  request: {
    params: productSlugParamsSchema,
  },
  responses: {
    200: {
      description: "Product retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: productResponseSchema,
          }),
        },
      },
    },
  },
});

/**
 * POST /api/v1/catalog/products
 */
registry.registerPath({
  method: "post",
  path: "/api/v1/catalog/products",
  tags: ["Catalog - Products"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createProductSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Product created successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: productResponseSchema,
          }),
        },
      },
    },
  },
});

/**
 * PATCH /api/v1/catalog/products/{productId}
 */
registry.registerPath({
  method: "patch",
  path: "/api/v1/catalog/products/{productId}",
  tags: ["Catalog - Products"],
  security: [{ bearerAuth: [] }],
  request: {
    params: productIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: updateProductSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Product updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: productResponseSchema,
          }),
        },
      },
    },
  },
});

/**
 * DELETE /api/v1/catalog/products/{productId}
 */
registry.registerPath({
  method: "delete",
  path: "/api/v1/catalog/products/{productId}",
  tags: ["Catalog - Products"],
  security: [{ bearerAuth: [] }],
  request: {
    params: productIdParamsSchema,
  },
  responses: {
    200: {
      description: "Product archived successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: productResponseSchema,
          }),
        },
      },
    },
  },
});