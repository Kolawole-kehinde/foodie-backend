import type z from "zod";
import type { verifyEmailSchema } from "../validators/verify-email.validator.js";

export type VerifyEmailRequestDto = z.infer<typeof verifyEmailSchema>