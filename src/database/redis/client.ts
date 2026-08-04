// Creates the Redis connection.

import Redis from "ioredis";
import { env } from "../../config/env.js";


const globalForRedis = globalThis as typeof globalThis & {
  redis?: Redis;
};

const createRedisClient = () => {
  return new Redis({
    host: env.redis.HOST,
    port: env.redis.PORT,
    password: env.redis.PASSWORD || undefined,
    db: env.redis.DB,

    maxRetriesPerRequest: null,

    enableReadyCheck: true,

    lazyConnect: true,

    retryStrategy(times) {
      return Math.min(times * 100, 3000);
    },
  });
};

export const redis =
  globalForRedis.redis ?? createRedisClient();

if (env.app.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}