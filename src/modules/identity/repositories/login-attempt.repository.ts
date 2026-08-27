import type { LoginFailureReason } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

type CreateLoginAttemptData = {
  userId?: string;
  email?: string;
  success: boolean;
  failureReason?: LoginFailureReason;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
};

export const createLoginAttemptRepository = (db: DatabaseClient) => {
  const create = async (data: CreateLoginAttemptData) => {
    return db.loginAttempt.create({
      data,
    });
  };

  const findLatestSuccessfulByUserId = async (userId: string) => {
    return db.loginAttempt.findFirst({
      where: {
        userId,
        success: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  return {
    create,
    findLatestSuccessfulByUserId,
  };
};

export type LoginAttemptRepository = ReturnType <typeof createLoginAttemptRepository>;
