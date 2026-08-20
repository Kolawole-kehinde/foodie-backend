// Responsible for exactly one thing:
// Create the Prisma Client
// Export a singleton



import { PrismaClient } from "@prisma/client";
import { env } from "../../config/env.js";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const createPrismaClient = () => {
  return new PrismaClient({
    log:
      env.app.NODE_ENV === "development"
        ? ["info", "warn", "error"]
        : ["warn", "error"],
  });
};

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (env.app.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}