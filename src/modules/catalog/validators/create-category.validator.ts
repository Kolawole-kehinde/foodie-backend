import { z } from "../../../docs/zod-openapi.js";

export const createCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(100, "Category name must not exceed 100 characters"),

  slug: z
    .string()
    .trim()
    .min(2, "Category slug must be at least 2 characters")
    .max(100, "Category slug must not exceed 100 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),

  description: z
    .string()
    .trim()
    .max(500, "Category description must not exceed 500 characters")
    .optional(),

  imageUrl: z
    .string()
    .url("Image URL must be a valid URL")
    .optional(),
});