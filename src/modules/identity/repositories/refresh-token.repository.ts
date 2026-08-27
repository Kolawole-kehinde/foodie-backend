import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createRefreshTokenRepository = (db: DatabaseClient) => {
  const create = async (data: Prisma.RefreshTokenCreateInput) => {
    return db.refreshToken.create({
      data,
    });
  };

  const findByTokenHash = async (tokenHash: string) => {
    return db.refreshToken.findUnique({
      where: {
        tokenHash,
      },
      include: {
        session: {
          include: {
            user: {
              include: {
                roles: {
                  include: {
                    role: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  };

  const revoke = async (id: string) => {
    return db.refreshToken.update({
      where: {
        id,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  };

  const markAsReplaced = async (id: string, replacedByTokenId: string) => {
    return db.refreshToken.update({
      where: {
        id,
      },
      data: {
        revokedAt: new Date(),
        replacedByTokenId,
      },
    });
  };

  /**
   * Atomically rotates a refresh token.
   *
   * The old token must still be active when the rotation happens.
   *
   * If another request has already rotated the token,
   * no row will be updated and `rotated` will be false.
   */
  const rotate = async ({
    oldTokenId,
    sessionId,
    newTokenHash,
    newTokenExpiresAt,
  }: {
    oldTokenId: string;
    sessionId: string;
    newTokenHash: string;
    newTokenExpiresAt: Date;
  }) => {
    const newRefreshToken = await db.refreshToken.create({
      data: {
        tokenHash: newTokenHash,
        expiresAt: newTokenExpiresAt,
        session: {
          connect: {
            id: sessionId,
          },
        },
      },
    });

    const result = await db.refreshToken.updateMany({
      where: {
        id: oldTokenId,
        sessionId,
        revokedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: newRefreshToken.id,
      },
    });

    if (result.count !== 1) {
      throw new Error("REFRESH_TOKEN_ALREADY_ROTATED");
    }

    await db.userSession.update({
      where: {
        id: sessionId,
      },
      data: {
        lastActivityAt: new Date(),
      },
    });

    return newRefreshToken;
  };

  const deleteExpired = async () => {
    return db.refreshToken.deleteMany({
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
    revoke,
    markAsReplaced,
    rotate,
    deleteExpired,
  };
};

export type RefreshTokenRepository = ReturnType<
  typeof createRefreshTokenRepository
>;
