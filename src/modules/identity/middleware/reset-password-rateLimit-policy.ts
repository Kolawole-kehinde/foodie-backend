import type { Request } from "express";
import type { RateLimitRule } from "../../../shared/rate-limit/rate-limit.types.js";
import { rateLimitKeys } from "../../../shared/rate-limit/rate-limit.keys.js";

const FIFTEEN_MINUTES = 15 * 60;

export const resetPasswordRateLimitPolicy = (req: Request): RateLimitRule[] => {
    const ip = req.ip ?? "unknown";

    return[
        {
            name: "reset-password",
            key: rateLimitKeys.ip("reset-password", ip),
            limit: 5,
            windowSeconds: FIFTEEN_MINUTES
        }
    ]

}