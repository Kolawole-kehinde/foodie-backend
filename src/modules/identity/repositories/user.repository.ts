import { LoginFailureReason } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";
import type { CreateUserData, UpdateUserData } from "./types.js";


export const createUserRepository = (db: DatabaseClient) => {
  const findById = async (id: string) => {
    return db.user.findUnique({
      where: { id },
    });
  };

  
  const incrementFailedLoginAttempts = async (id: string) => {
   return db.user.update({
    where: {id},
    data:{
       failedLoginAttempts: {
        increment: 1
       },
       select:  {
           failedLoginAttempts: true
       }
    }
   })
  };

  const resetFailedLoginAttempts = async (id: string) => {
      return db.user.update({
        where: {id},
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      })
  }

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
    incrementFailedLoginAttempts,
    resetFailedLoginAttempts,
    findByEmail,
    create,
    update,
  };
};

export type UserRepository = ReturnType<typeof createUserRepository>;