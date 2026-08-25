import type { Request } from "express";
import { rateLimitKeys } from "../../../shared/rate-limit/rate-limit.keys.js";
import type { RateLimitRule } from "../../../shared/rate-limit/rate-limit.types.js";

const ONE_HOUR = 60 * 60;

export const registrationRateLimitPolicy = (req: Request): RateLimitRule[] => {

  const email = String(req.body.email) .trim() .toLowerCase();

  const ip = req.ip ?? "unknown";

  return [
    {
      name: "registration-email",
      key: rateLimitKeys.email("register", email),
      limit: 5,
      windowSeconds: ONE_HOUR,
    },

    {
      name: "registration-ip",
      key: rateLimitKeys.ip("register", ip),
      limit: 30,
      windowSeconds: ONE_HOUR,
    },
  ];
};