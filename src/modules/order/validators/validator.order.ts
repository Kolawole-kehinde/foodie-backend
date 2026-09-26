import { z } from "zod";

export const buyNowSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

export const cancelOrderParamsSchema = orderIdParamsSchema;