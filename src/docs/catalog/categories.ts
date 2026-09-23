import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

import {
  createCategorySchema,
  updateCategorySchema,
} from "../../modules/catalog/validators/category.validator.js";

const categoryResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const categoryIdParamsSchema = z.object({
  id: z.string().cuid("Invalid category ID"),
});

const categorySlugParamsSchema = z.object({
  slug: z.string().min(1, "Category slug is required"),
});

registry.registerPath({
  method: "get",
  path: "/api/v1/catalog/categories",
  tags: ["Catalog - Categories"],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Categories retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: z.array(categoryResponseSchema),
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/catalog/categories/{id}",
  tags: ["Catalog - Categories"],
  security: [{ bearerAuth: [] }],
  request: {
    params: categoryIdParamsSchema,
  },
  responses: {
    200: {
      description: "Category retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: categoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/catalog/categories/slug/{slug}",
  tags: ["Catalog - Categories"],
  security: [{ bearerAuth: [] }],
  request: {
    params: categorySlugParamsSchema,
  },
  responses: {
    200: {
      description: "Category retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: categoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/api/v1/catalog/categories",
  tags: ["Catalog - Categories"],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: createCategorySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Category created successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: categoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/catalog/categories/{id}",
  tags: ["Catalog - Categories"],
  security: [{ bearerAuth: [] }],
  request: {
    params: categoryIdParamsSchema,
    body: {
      content: {
        "application/json": {
          schema: updateCategorySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Category updated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: categoryResponseSchema,
          }),
        },
      },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/api/v1/catalog/categories/{id}",
  tags: ["Catalog - Categories"],
  security: [{ bearerAuth: [] }],
  request: {
    params: categoryIdParamsSchema,
  },
  responses: {
    200: {
      description: "Category deactivated successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.literal(true),
            data: categoryResponseSchema,
          }),
        },
      },
    },
  },
});