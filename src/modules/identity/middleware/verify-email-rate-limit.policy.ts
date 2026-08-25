import type { Request } from "express"
import type { RateLimitRule } from "../../../shared/rate-limit/rate-limit.types.js"
import { rateLimitKeys } from "../../../shared/rate-limit/rate-limit.keys.js";



const FIFTEEN_MINUTES = 15 * 60;


export const verifyEmailRateLimitPolicy = (req: Request): RateLimitRule[] => {
    const ip = req.ip ?? "unknown"

    return[
        {
            name: "verify-email-limit",
            key: rateLimitKeys.ip("verify-email-limit", ip),
            limit: 20,
            windowSeconds: FIFTEEN_MINUTES

        }
    ]

}