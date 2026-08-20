import type { DatabaseClient } from "../../../database/prisma/types.js";

export type CreatePendingRegistrationData = {
  email: string;
  passwordHash: string;
  verificationTokenHash: string;
  verificationTokenExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

type PendingRegistrationUpdateData =
  Parameters<
    DatabaseClient["pendingRegistration"]["update"]
  >[0]["data"];

export const createPendingRegistrationRepository = (db: DatabaseClient) => {

  const findByEmail = async (email: string) => {
    return db.pendingRegistration.findUnique({
      where: { email },
    });
  };

  const findByTokenHash = async (verificationTokenHash: string) => {
    return db.pendingRegistration.findUnique({
      where: {
        verificationTokenHash,
      },
    });
  };

  const create = async (data: CreatePendingRegistrationData) => {
    return db.pendingRegistration.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        verificationTokenHash: data.verificationTokenHash,
        verificationTokenExpiresAt:
          data.verificationTokenExpiresAt,

        ...(data.ipAddress !== undefined
          ? { ipAddress: data.ipAddress }
          : {}),

        ...(data.userAgent !== undefined
          ? { userAgent: data.userAgent }
          : {}),
      },
    });
  };

  const deleteById = async (id: string) => {
    return db.pendingRegistration.delete({
      where: { id },
    });
  };

  const deleteByEmail = async (email: string) => {
    return db.pendingRegistration.delete({
      where: { email },
    });
  };

  const update = async (
    id: string,
    data: PendingRegistrationUpdateData
  ) => {
    return db.pendingRegistration.update({
      where: { id },
      data,
    });
  };

  return {
    findByEmail,
    findByTokenHash,
    create,
    deleteById,
    deleteByEmail,
    update,
  };
};

export type PendingRegistrationRepository = ReturnType<typeof createPendingRegistrationRepository>;