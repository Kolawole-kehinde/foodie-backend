import { z } from "../../../docs/zod-openapi.js";

export const initializeInventorySchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
});

export const addStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),
  reason: z
    .string()
    .trim()
    .max(500, "Reason must not exceed 500 characters")
    .optional(),
});

export const removeStockSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z
    .number()
    .int("Quantity must be an integer")
    .positive("Quantity must be greater than zero"),
  reason: z
    .string()
    .trim()
    .max(500, "Reason must not exceed 500 characters")
    .optional(),
});