import { z } from "../../../docs/zod-openapi.js";



export const refreshTokenCookieSchema = z.object({
  refreshToken: z.string().min(1, "Refresh token is required"),
});