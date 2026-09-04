import { z } from "../../../docs/zod-openapi.js";

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .meta({
      description: "The email address associated with the account",
      example: "user@example.com",
    }),
});

export type ForgotPasswordInput = z.infer<
  typeof forgotPasswordSchema
>;