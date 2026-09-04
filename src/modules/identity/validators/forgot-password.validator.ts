import { z } from "../../../docs/zod-openapi.js";

export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address"),
});

export type ForgotPasswordInput = z.infer<
  typeof forgotPasswordSchema
>;