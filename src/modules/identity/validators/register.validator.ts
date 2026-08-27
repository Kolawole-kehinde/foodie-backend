import { z } from "../../../docs/zod-openapi.js";

export const registerSchema = z.object({
  email: z
    .email("Invalid email address")
    .trim()
    .toLowerCase()
    .meta({
      description: "The user's email address",
      example: "test@example.com",
    }),

  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long")
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(
      /[^A-Za-z0-9]/,
      "Must contain a special character"
    )
    .meta({
      description: "Account password",
      example: "Password@123",
    }),
});