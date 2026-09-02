import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";


export const createPasswordResetTokenRepository = (db: DatabaseClient) => {
    const create = async (data: Prisma.PasswordResetTokenCreateInput) =>{
       return db.passwordResetToken.create({
        data,
       }) 
    }

    const findByTokenHash = async (tokenHash: string) => {
       return db.passwordResetToken.findUnique({
         where: {
            tokenHash,
             include:{
            user: true
        }
         }
       
       })
    }


    const markAsUsed = async (id: string) => {
       return db.passwordResetToken.update({
        where: {
            id
        },
         data:{
               usedAt: new Date(), 
            }
       })
    }


    const deleteExpired = async () => {
         return db.passwordResetToken.deleteMany({
            where: {
               expiresAt: {
                 lt: new Date(),
                 },
            }
         })
    }

    return{
        create,
        findByTokenHash,
        markAsUsed,
        deleteExpired,
    }
}


export type PasswordResetTokenRepository = ReturnType <typeof createPasswordResetTokenRepository>