import { logger } from "../../config/logger.js";
import { prisma } from "../../database/prisma/client.js";
import { createS3Service } from "../../infrastructure/s3/s3.service.js";


export const createMediaUploadsCleanup = () => {
  const s3Service = createS3Service();

  const run = async () => {
    const now = new Date();

    logger.info(
      { now },
      "[Cleanup:MediaUploads] Checking for expired media uploads",
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
        "[Cleanup:MediaUploads] No expired media uploads found",
      );

      return 0;
    }

    logger.info(
      {
        uploadCount: uploads.length,
      },
      "[Cleanup:MediaUploads] Found expired media uploads",
    );

    await Promise.all(
      uploads.map(async (upload) => {
        try {
          await s3Service.deleteObject(upload.objectKey);

          logger.info(
            {
              uploadId: upload.id,
            },
            "[Cleanup:MediaUploads] S3 object deleted",
          );
        } catch (error) {
          logger.error(
            {
              err: error,
              uploadId: upload.id,
            },
            "[Cleanup:MediaUploads] Failed to delete S3 object",
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
      "[Cleanup:MediaUploads] Cleanup completed",
    );

    return result.count;
  };

  return {
    run,
  };
};

export type MediaUploadsCleanup = ReturnType<
  typeof createMediaUploadsCleanup
>;