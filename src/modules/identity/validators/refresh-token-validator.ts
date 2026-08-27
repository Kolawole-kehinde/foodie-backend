import { z } from "../../../docs/zod-openapi.js";

export const refreshTokenSchema = z.object({
  refreshToken: z
    .string()
    .min(1, "Refresh token is required"),
});

export type RefreshTokenRequest = z.infer<typeof refreshTokenSchema>;