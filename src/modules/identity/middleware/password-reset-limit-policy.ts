
import type { RateLimitRule } from "../../../shared/rate-limit/rate-limit.types.js";
import type { Request } from "express";
import { rateLimitKeys } from "../../../shared/rate-limit/rate-limit.keys.js";


const ONE_HOUR = 60 * 60;

export const passwordResetPolicy = (req: Request): RateLimitRule[] => {
  
    const email = String(req.body.email ?? "").trim().toLowerCase(); 
    
    const ip = req.ip ?? "unknown";

    return[
        {
            name: "forget-password-email",
            key:  rateLimitKeys.email("passwordReset", email),
            limit: 5,
            windowSeconds: ONE_HOUR
        },

        {
            name: "forget-password-ip",
            key: rateLimitKeys.ip("passwordReset", ip),
            limit: 30,
            windowSeconds: ONE_HOUR
        }

    ]
}