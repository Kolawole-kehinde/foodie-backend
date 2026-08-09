import type { DatabaseClient } from "../../../database/prisma/types.js";
import type {
  CreateEmailVerificationTokenData,
  UpdateEmailVerificationTokenData,
} from "./types.js";

export const createEmailVerificationTokenRepository = (db: DatabaseClient) => {
  const create = async (data: CreateEmailVerificationTokenData) => {
    return db.emailVerificationToken.create({
      data,
    });
  };

  const findByTokenHash = async (tokenHash: string) => {
    return db.emailVerificationToken.findUnique({
      where: {
        tokenHash,
      },
    });
  };

  const markAsUsed = async (id: string, data?: UpdateEmailVerificationTokenData,) => {
    return db.emailVerificationToken.update({
      where: { id },
      data: {
        usedAt: new Date(),
        ...data,
      },
    });
  };

  const deleteExpired = async () => {
    return db.emailVerificationToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });
  };

  return {
    create,
    findByTokenHash,
    markAsUsed,
    deleteExpired,
  };
};

export type EmailVerificationTokenRepository = ReturnType<
  typeof createEmailVerificationTokenRepository
>;
