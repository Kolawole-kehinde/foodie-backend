import type { DatabaseClient } from "../../../database/prisma/types.js";


type CreatePendingRegistrationData = {
  email: string;
  passwordHash: string;
  verificationTokenHash: string;
  verificationTokenExpiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
};

export const createPendingRegistrationRepository = ( db: DatabaseClient) => {

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
      data,
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

  const update = async (id: string, data: Partial<CreatePendingRegistrationData>) => {
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

export type PendingRegistrationRepository = ReturnType<
  typeof createPendingRegistrationRepository
>;