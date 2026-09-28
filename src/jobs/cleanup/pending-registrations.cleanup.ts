import { logger } from "../../config/logger.js";
import { prisma } from "../../database/prisma/client.js";

export const createPendingRegistrationsCleanup = () => {
  const run = async () => {
    const now = new Date();

    logger.info(
      { now },
      "[Cleanup:PendingRegistrations] Checking for expired registrations",
    );

    const result = await prisma.pendingRegistration.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    logger.info(
      {
        deletedCount: result.count,
      },
      "[Cleanup:PendingRegistrations] Cleanup completed",
    );

    return result.count;
  };

  return {
    run,
  };
};

export type PendingRegistrationsCleanup = ReturnType<
  typeof createPendingRegistrationsCleanup
>;