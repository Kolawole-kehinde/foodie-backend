import type { LoginFailureReason } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

type CreateLoginAttemptData = {
  userId?: string;
  email?: string;
  success: boolean;
  failureReason?: LoginFailureReason;
  ipAddress?: string;
  userAgent?: string;
};



export const createLoginAttemptRepository = (db: DatabaseClient) =>{

    const create = async(data: CreateLoginAttemptData) =>{
        return db.loginAttempt.create({
            data
        })

    };
    return{
        create
    }

}

export type LoginAttemptRepository = ReturnType <typeof createLoginAttemptRepository>