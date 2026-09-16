
import { z } from "../../../docs/zod-openapi.js";

export const userIdSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});