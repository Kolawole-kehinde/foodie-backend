import { z } from "../../../docs/zod-openapi.js";

export const productQuerySchema = z.object({
  category: z.string().trim().min(1, "Category is required").optional(),

  search: z
    .string()
    .trim()
    .min(1, "Search term cannot be empty")
    .max(100, "Search term must not exceed 100 characters")
    .optional(),

  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),

  page: z.coerce
    .number()
    .int("Page must be a whole number")
    .min(1, "Page must be at least 1")
    .default(1),

  limit: z.coerce
    .number()
    .int("Limit must be a whole number")
    .min(1, "Limit must be at least 1")
    .max(100, "Limit must not exceed 100")
    .default(20),

  sortBy: z
    .enum(["createdAt", "price", "name"])
    .default("createdAt"),

  sortOrder: z
    .enum(["asc", "desc"])
    .default("desc"),
});