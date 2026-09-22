import { z } from "../../../docs/zod-openapi.js";

export const createProductSchema = z.object({
  categoryId: z.string().cuid("Invalid category ID"),

  name: z
    .string()
    .trim()
    .min(2, "Product name must be at least 2 characters")
    .max(150, "Product name must not exceed 150 characters"),

  slug: z
    .string()
    .trim()
    .min(2, "Product slug must be at least 2 characters")
    .max(150, "Product slug must not exceed 150 characters")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug must contain only lowercase letters, numbers, and hyphens",
    ),

  description: z
    .string()
    .trim()
    .min(1, "Product description is required")
    .max(2000, "Product description must not exceed 2000 characters"),

  price: z
    .number()
    .positive("Product price must be greater than zero")
    .finite("Product price must be a valid number"),

  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
});