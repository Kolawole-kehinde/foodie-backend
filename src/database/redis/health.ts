import { redis } from "./client.js";

export const checkRedisHealth = async (): Promise<boolean> => {
  try {
    const result = await redis.ping();

    return result === "PONG";
  } catch {
    return false;
  }
};