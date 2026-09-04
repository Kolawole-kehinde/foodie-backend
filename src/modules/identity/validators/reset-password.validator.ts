import { z } from "../../../docs/zod-openapi.js";

export const resetPasswordSchema = z
  .object({
    token: z
      .string()
      .min(1, "Reset token is required"),

    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(
        /[^A-Za-z0-9]/,
        "Must contain a special character"
      ),

    confirmPassword: z
      .string()
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordInput = z.infer<
  typeof resetPasswordSchema
>;