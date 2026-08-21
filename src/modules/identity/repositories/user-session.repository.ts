import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";




export const createUserSessionRepository = (db: DatabaseClient) => {
    const create = async (data: Prisma.UserSessionCreateInput) =>{
      return db.userSession.create({
        data
      })
    };

    const findById = async (id: string) => {
      return db.userSession.findUnique({
        where :{id}
     })
    }

    const findUserById = async (userId: string) => {
        return db.userSession.findMany({
            where: {userId},
            orderBy: {
                createdAt: "desc"
            }
        })
    };

    const updateLastActivity = async (id: string) => {
       return db.userSession.update({
            where: {id},
            data: {
                lastActivityAt: new Date(),
            } 
        })
    };

    const revoke = async (id: string, reason?: Prisma.UserSessionUpdateInput["revokeReason"]) => {
         return db.userSession.update({
            where: {id},
            data:{
                revokedAt: new Date(),
                revokeReason: reason,
            }
        })
        
    };

    const revokeAllForUser = async (userId: string, reason?: Prisma.UserSessionUpdateInput["revokeReason"]) => {
       return db.userSession.updateMany ({
        where: {
            userId,
            revokedAt: null
        },
        data: {
            revokedAt: new Date(),
            revokeReason: reason
        }
       })
    }


    return{
        create,
        findById,
        findUserById,
        updateLastActivity,
        revoke,
        revokeAllForUser
    }


};

export type createUserSessionRepository = ReturnType < typeof createUserSessionRepository>