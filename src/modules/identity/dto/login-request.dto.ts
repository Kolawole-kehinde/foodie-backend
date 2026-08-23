import type { z } from "zod/mini";
import type { loginSchema } from "../validators/login.validator.js";



export type LoginRequestDto = z.infer<typeof loginSchema>