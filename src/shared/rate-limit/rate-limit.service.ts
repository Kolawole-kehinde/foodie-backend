import { redis } from "../../database/redis/client.js";
import type {RateLimitRule,RateLimitResult,} from "./rate-limit.types.js";

/**
 * Atomically:
 *
 * 1. Increment the request counter
 * 2. Set expiration on the first request
 * 3. Get the remaining TTL
 *
 * Redis executes the entire script atomically.
 */
const RATE_LIMIT_SCRIPT = `
  local count = redis.call("INCR", KEYS[1])

  if count == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end

  local ttl = redis.call("TTL", KEYS[1])

  return { count, ttl }
`;

export const createRateLimitService = () => {
  const check = async ( rule: RateLimitRule): Promise<RateLimitResult> => {
    /**
     * KEYS[1] = rate-limit key
     * ARGV[1] = window duration in seconds
     */
    const result = await redis.eval(
      RATE_LIMIT_SCRIPT,
      1,
      rule.key,
      rule.windowSeconds
    ) as [number, number];

    const [currentCount, ttl] = result;

    const remaining = Math.max(
      rule.limit - currentCount,
      0
    );

    return {
      name: rule.name,

      allowed:
        currentCount <= rule.limit,

      limit:
        rule.limit,

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

export type RateLimitService =  ReturnType<typeof createRateLimitService>;