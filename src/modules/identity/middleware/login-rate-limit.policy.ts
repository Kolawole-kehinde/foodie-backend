import type { Request } from "express";
import type { RateLimitRule } from "../../../shared/rate-limit/rate-limit.types.js";
import { rateLimitKeys } from "../../../shared/rate-limit/rate-limit.keys.js";

const ONE_HOUR = 60 * 60;

export const loginRateLimitPolicy = (
  req: Request
): RateLimitRule[] => {
  const email = String(req.body.email)
    .trim()
    .toLowerCase();

  const ip = req.ip ?? "unknown";

  return [
    {
      name: "login-email",
      key: rateLimitKeys.email("login", email),
      limit: 5,
      windowSeconds: ONE_HOUR,
    },

    {
      name: "login-ip",
      key: rateLimitKeys.ip("login", ip),
      limit: 30,
      windowSeconds: ONE_HOUR,
    },
  ];
};