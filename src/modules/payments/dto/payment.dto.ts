import { PaymentProvider } from "@prisma/client";
import { z } from "zod";

/**
 * Client request for initializing a payment.
 *
 * The client only provides:
 * - orderId
 * - payment provider
 * - optional callback URL
 *
 * Amount, user, email, and currency are trusted server-side
 * values and must not come from the client.
 */
export const initializePaymentSchema = z.object({
  orderId: z.string().cuid("Invalid order ID"),

  provider: z.enum(
    Object.values(PaymentProvider) as [PaymentProvider, ...PaymentProvider[]],
  ),

  callbackUrl: z.string().url("Invalid callback URL").optional(),
});

export type InitializePaymentDto = z.infer<typeof initializePaymentSchema>;
