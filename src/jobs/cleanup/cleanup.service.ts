import { logger } from "../../config/logger.js";
import { prisma } from "../../database/prisma/client.js";
import { createS3Service } from "../../infrastructure/s3/s3.service.js";

export const createCleanupService = () => {
  const s3Service = createS3Service();

  const cleanupPendingRegistrations = async () => {
    const now = new Date();

    logger.info(
      { now },
      "[Cleanup] Checking for expired pending registrations",
    );

    const result = await prisma.pendingRegistration.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    });

    logger.info(
      {
        deletedCount: result.count,
      },
      "[Cleanup] Expired pending registrations deleted",
    );

    return result.count;
  };

  const cleanupMediaUploads = async () => {
    const now = new Date();

    logger.info(
      { now },
      "[Cleanup] Checking for expired media uploads",
    );

    const uploads = await prisma.mediaUpload.findMany({
      where: {
        status: "PENDING",
        expiresAt: {
          not: null,
          lt: now,
        },
      },
      select: {
        id: true,
        objectKey: true,
      },
    });

    if (uploads.length === 0) {
      logger.info(
        "[Cleanup] No expired media uploads found",
      );

      return 0;
    }

    logger.info(
      {
        uploadCount: uploads.length,
      },
      "[Cleanup] Found expired media uploads",
    );

    await Promise.all(
      uploads.map(async (upload) => {
        try {
          await s3Service.deleteObject(upload.objectKey);

          logger.info(
            {
              uploadId: upload.id,
            },
            "[Cleanup] Media upload S3 object deleted",
          );
        } catch (error) {
          logger.error(
            {
              err: error,
              uploadId: upload.id,
            },
            "[Cleanup] Failed to delete media upload S3 object",
          );

          throw error;
        }
      }),
    );

    const result = await prisma.mediaUpload.deleteMany({
      where: {
        id: {
          in: uploads.map((upload) => upload.id),
        },
        status: "PENDING",
      },
    });

    logger.info(
      {
        deletedCount: result.count,
      },
      "[Cleanup] Expired media uploads deleted",
    );

    return result.count;
  };

  return {
    cleanupPendingRegistrations,
    cleanupMediaUploads,
  };
};

export type CleanupService = ReturnType<typeof createCleanupService>;
