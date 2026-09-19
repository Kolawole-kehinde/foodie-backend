import type { Request } from "express"
import type { RateLimitRule } from "../../../shared/rate-limit/rate-limit.types.js"
import { rateLimitKeys } from "../../../shared/rate-limit/rate-limit.keys.js";



const FIFTEEN_MINUTES = 60 * 60


export const resendVerificationRateLimitPolicy = (req: Request): RateLimitRule[] => {
    const ip = req.ip ?? "unknown"

    return[
        {
            name: "resend-verification",
            key: rateLimitKeys.ip("resend-verification", ip),
            limit: 20,
            windowSeconds: FIFTEEN_MINUTES

        }
    ]

}