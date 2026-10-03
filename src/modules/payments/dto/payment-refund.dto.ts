import { z } from "zod";

export const createPaymentRefundSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, "Invalid refund amount")
    .optional(),

  reason: z
    .string()
    .trim()
    .max(500, "Refund reason cannot exceed 500 characters")
    .optional(),
});

export type CreatePaymentRefundDto = z.infer<
  typeof createPaymentRefundSchema
>;