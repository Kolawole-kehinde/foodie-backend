import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createUserSessionRepository = (db: DatabaseClient) => {
  const create = async (data: Prisma.UserSessionCreateInput) => {
    return db.userSession.create({
      data,
    });
  };

  const findById = async (id: string) => {
    return db.userSession.findUnique({
      where: { id },
      include: {
        user: true,
      },
    });
  };

  const findUserById = async (userId: string) => {
    return db.userSession.findMany({
      where: { userId },
      orderBy: {
        createdAt: "desc",
      },
    });
  };

const findActiveById = async (id: string) => {
  return db.userSession.findFirst({
    where: {
      id,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      user: true,
    },
  });
};

const findActiveByUserId = async (userId: string) => {
  return db.userSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      lastActivityAt: "desc",
    },
  });
};

  const updateLastActivity = async (id: string) => {
    return db.userSession.update({
      where: { id },
      data: {
        lastActivityAt: new Date(),
      },
    });
  };

  const revoke = async (id: string,reason?: Prisma.UserSessionUpdateInput["revokeReason"],) => {
    return db.userSession.updateMany({
      where: {
        id,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  };

  const revokeForUser = async (userId: string, sessionId: string, reason?: Prisma.UserSessionUpdateInput["revokeReason"]) => {
       return db.userSession.updateMany({
        where: {
          id: sessionId,
          userId,
          revokedAt: null,
        },
        data: {
           revokedAt: new Date(),
           revokeReason: reason
        }
       })
  }


  const revokeAllForUser = async (userId: string,reason?: Prisma.UserSessionUpdateInput["revokeReason"],) => {
    return db.userSession.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokeReason: reason,
      },
    });
  };

  return {
    create,
    findById,
    findUserById,
    findActiveByUserId,
    updateLastActivity,
    revoke,
    revokeForUser,
    revokeAllForUser,
    findActiveById,
  };
};

export type UserSessionRepository = ReturnType<
  typeof createUserSessionRepository
>;
