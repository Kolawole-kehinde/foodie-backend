// Used only for health checks.import { prisma } from "./client";

import { prisma } from "./client.js";

export async function checkDatabaseHealth() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return {
      status: "up",
    };
  } catch {
    return {
      status: "down",
    };
  }
}