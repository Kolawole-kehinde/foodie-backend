import { z } from "../../../docs/zod-openapi.js";

export const verifyEmailSchema = z.object({
   token: z.string().min(1, "Verification token is required")
})