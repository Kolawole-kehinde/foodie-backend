import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";





type CreateMediaUploadData = {
  uploadedById: string;
  type: Prisma.MediaUploadCreateInput["type"];
  objectKey: string;
  contentType: string;
  expiresAt: Date;
};


export const createMediaUploadRepository = (db: DatabaseClient) => {
    const create = async (data: CreateMediaUploadData) => {
        return db.mediaUpload.create({
              data: {
                uploadedById: data.uploadedById,
                type: data.type,
                objectKey: data.objectKey,
                contentType: data.contentType,
                expiresAt: data.expiresAt
              }
        })
    }

    const findById = async (id: string, uploadedById: string) => {
      return db.mediaUpload.findFirst({
        where: {
            id,
            uploadedById
        }
      })
    };

    const markReady = async (id: string, uploadedById: string, fileSize: number) => {
        return db.mediaUpload.updateMany({
            where: {
                id,
                uploadedById,
                status: "PENDING"
            },
            data:{
               status: "READY",
               fileSize
            }
        })
    };

    const markFailed  = async (id: string, uploadedById: string) => {
       return db.mediaUpload.updateMany({
          where: {
            id,
            uploadedById,
            status: "PENDING"
          },
          data: {
            status: "FAILED"
          }
       })
    }

    return {
        create,
        findById,
        markReady,
        markFailed
    }
}


export type MediaUploadRepository = ReturnType <typeof createMediaUploadRepository>
