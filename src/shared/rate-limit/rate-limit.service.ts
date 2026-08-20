import { redis } from "../../database/redis/client.js";

import type {
  RateLimitRule,
  RateLimitResult,
} from "./rate-limit.types.js";

export const createRateLimitService = () => {
  const check = async (
    rule: RateLimitRule
  ): Promise<RateLimitResult> => {
    const currentCount = await redis.incr(rule.key);

    if (currentCount === 1) {
      await redis.expire(
        rule.key,
        rule.windowSeconds
      );
    }

    const ttl = await redis.ttl(rule.key);

    const remaining = Math.max(
      rule.limit - currentCount,
      0
    );

    return {
      name: rule.name,
      allowed: currentCount <= rule.limit,
      limit: rule.limit,
      remaining,
      resetAt:
        Date.now() +
        Math.max(ttl, 0) * 1000,
    };
  };

  return {
    check,
  };
};

export type RateLimitService =
  ReturnType<typeof createRateLimitService>;