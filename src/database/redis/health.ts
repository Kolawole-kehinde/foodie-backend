// Used only for health checks.

import { redis } from "./client";

export async function checkRedisHealth() {
  try {
    await redis.ping();

    return {
      status: "up",
    };
  } catch {
    return {
      status: "down",
    };
  }
}