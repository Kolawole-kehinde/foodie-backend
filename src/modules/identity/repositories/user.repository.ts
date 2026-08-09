import type { DatabaseClient } from "../../../database/prisma/types.js";
import type { CreateUserData, UpdateUserData } from "./types.js";


export const createUserRepository = (db: DatabaseClient) => {
  const findById = async (id: string) => {
    return db.user.findUnique({
      where: { id },
    });
  };

  const findByEmail = async (email: string) => {
    return db.user.findUnique({
      where: { email },
    });
  };

  const create = async (data: CreateUserData) => {
    return db.user.create({
      data,
    });
  };

  const update = async (id: string,data: UpdateUserData) => {
    return db.user.update({
      where: { id },
      data,
    });
  };

  return {
    findById,
    findByEmail,
    create,
    update,
  };
};

export type UserRepository = ReturnType<typeof createUserRepository>;