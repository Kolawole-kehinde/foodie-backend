import { Redis } from "ioredis";
import { env } from "../../config/env.js";

const createRedisClient = () => {
  return new Redis({
    host: env.redis.HOST,
    port: env.redis.PORT,
    password: env.redis.PASSWORD || undefined,
    db: env.redis.DB,

    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,

    retryStrategy(times: number) {
      return Math.min(times * 100, 3000);
    },
  });
};

type RedisClient = ReturnType<typeof createRedisClient>;

const globalForRedis = globalThis as typeof globalThis & {
  redis?: RedisClient;
};

export const redis =
  globalForRedis.redis ?? createRedisClient();

export const connectRedis = async () => {
  if (redis.status === "wait") {
    await redis.connect();
  }
};

if (env.app.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}