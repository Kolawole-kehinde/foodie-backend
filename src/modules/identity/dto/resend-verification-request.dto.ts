import type z from "zod";
import type { resendVerificationSchema } from "../validators/resend-verification.validator.js";

export type ResendVerificationRequestDto = z.infer<
  typeof resendVerificationSchema
>;