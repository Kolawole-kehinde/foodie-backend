import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";



export const createRefreshTokenRepository = (db: DatabaseClient) => {

    const create =async (data: Prisma.RefreshTokenCreateInput) => {
      return db.refreshToken.create ({
         data,
      })
    };


    const findByTokenHash = async (tokenHash: string) =>{
         return db.refreshToken.findUnique ({
            where: {tokenHash}
         })
    };


    const revoke = async (id: string) => {
       return db.refreshToken.update({
        where: {id},
        data: {
            revokedAt: new Date()
        }
       })
    };

    const markAsReplaced = async (id: string, replacedByTokenId: string) => {
      return db.refreshToken.update ({
        where: {id},
        data: {
          revokedAt: new Date(),
          replacedByTokenId,
        }
     })
    };

    const deleteExpired = async() => {
         return db.refreshToken.deleteMany({
            where: {
                expiresAt: {
                  lt: new Date(),
                }
            }
        })
    };

    return{
        create,
        findByTokenHash,
        revoke,
        markAsReplaced,
        deleteExpired
    }
}

export type RefreshTokenRepository = ReturnType<typeof createRefreshTokenRepository>