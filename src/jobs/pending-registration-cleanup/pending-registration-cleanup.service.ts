import { prisma } from "../../database/prisma/client.js";


export const createPendingRegistrationCleanupService = () => {
  const cleanup = async () => {
    const result = await prisma.pendingRegistration.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

    return result.count;
  };

  return {
    cleanup,
  };
};

export type PendingRegistrationCleanupService = ReturnType<typeof createPendingRegistrationCleanupService>;