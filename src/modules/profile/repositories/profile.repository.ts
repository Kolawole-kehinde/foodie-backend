import type { DatabaseClient } from "../../../database/prisma/types.js";
import type { UpdateProfileInput } from "../schemas/profile.schema.js";

export const createProfileRepository = (db: DatabaseClient) => {
  const findByUserId = async (userId: string) => {
    return db.profile.findUnique({
      where: {
        userId,
      },
    });
  };
  const create = async (userId: string, data: UpdateProfileInput = {}) => {
    return db.profile.create({
      data: {
        userId,
        ...data,
      },
    });
  };

  const update = async (userId: string, data: UpdateProfileInput) => {
    return db.profile.update({
      where: {
        userId,
      },
      data,
    });
  };

  const updateAvatarKey = async (userId: string, avatarKey: string) => {
    return db.profile.update({
      where: {
        userId,
      },
      data: {
        avatarKey,
      },
    });
  };

  return {
    findByUserId,
    create,
    update,
    updateAvatarKey,
  };
};

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
