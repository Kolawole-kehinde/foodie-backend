
import { z } from "zod";
import type { registerSchema } from "../validators/register.validator.js";

export type RegisterRequestDto = z.infer<typeof registerSchema>;