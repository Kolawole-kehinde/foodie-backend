import { LoginFailureReason } from "@prisma/client";
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

  const lockAccount = async (id:string, lockedUntil: Date) =>{
      return db.user.update({
         where: {id},
         data: {
          lockedUntil
         }
      })
  }

  const resetFailedLoginAttempts = async (id: string) => {
      return db.user.update({
        where: {id},
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null
        }
      })
  }

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
    incrementFailedLoginAttempts,
    resetFailedLoginAttempts,
    lockAccount,
    create,
    update,
  };
};

export type UserRepository = ReturnType<typeof createUserRepository>;