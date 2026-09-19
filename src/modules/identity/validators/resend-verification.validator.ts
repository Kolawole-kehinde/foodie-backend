import { z } from "../../../docs/zod-openapi.js";

export const resendVerificationSchema = z.object({
  email: z.string().email("Invalid email address"),
});