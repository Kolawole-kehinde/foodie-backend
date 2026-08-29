import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";
import { RefreshTokenAlreadyRotatedError } from "../../../shared/errors/RefreshTokenAlreadyRotatedError.js";

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

  const revokeAllByUserId = async (userId: string) => {
       return db.refreshToken.updateMany({
        where: {
          session: {
            userId
          },
            revokedAt: null
        },
        data: {
          revokeAt: new Date()
        }
       })
  }

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
    const now = new Date();

    // 1. Atomically claim the old refresh token.
    const result = await db.refreshToken.updateMany({
      where: {
        id: oldTokenId,
        sessionId,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        revokedAt: now,
      },
    });

    // Another request already rotated this token.
    if (result.count !== 1) {
      throw new RefreshTokenAlreadyRotatedError();
    }

    // 2. Create the replacement token.
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

    // 3. Link the old token to the replacement.
    await db.refreshToken.update({
      where: {
        id: oldTokenId,
      },
      data: {
        replacedByTokenId: newRefreshToken.id,
      },
    });

    // 4. Update session activity.
    await db.userSession.update({
      where: {
        id: sessionId,
      },
      data: {
        lastActivityAt: now,
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
    revokeAllByUserId ,
    revoke,
    rotate,
    deleteExpired,
  };
};

export type RefreshTokenRepository = ReturnType<typeof createRefreshTokenRepository>;
