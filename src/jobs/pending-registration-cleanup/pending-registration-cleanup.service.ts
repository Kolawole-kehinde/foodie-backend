import { prisma } from "../../database/prisma/client.js";
import { logger } from "../../config/logger.js";

export const createPendingRegistrationCleanupService = () => {
  const cleanup = async () => {
    const now = new Date();

    logger.info(
      { now },
      "[PendingRegistrationCleanup] Checking for expired registrations"
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
      "[PendingRegistrationCleanup] Expired registrations deleted"
    );

    return result.count;
  };

  return {
    cleanup,
  };
};