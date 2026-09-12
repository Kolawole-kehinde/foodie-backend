import type { DatabaseClient } from "../../database/prisma/types.js";
import { createMediaUploadRepository } from "./repositories/media-upload.repository.js";
import { createMediaUploadService } from "./services/media-upload.service.js";
import { createMediaUploadController } from "./controllers/media-upload.controller.js";
import type { S3Service } from "../../infrastructure/s3/s3.service.js";
import { createMediaUploadRoutes } from "./routes/media.routes.js";
import type { RequestHandler } from "express";


type CreateMediaDependencies = {
  db: DatabaseClient;
  s3Service: S3Service;
  authenticate: RequestHandler;
};

export const createMediaDependencies = ({
  db,
  s3Service,
  authenticate,
}: CreateMediaDependencies) => {
  const mediaUploadRepository = createMediaUploadRepository(db);

  const mediaUploadService = createMediaUploadService({
    mediaUploadRepository,
    s3Service,
  });

  const mediaUploadController = createMediaUploadController({
    mediaUploadService,
  });

  const mediaUploadRoutes = createMediaUploadRoutes({
    mediaUploadController,
    authenticate,
  });

  return {
    mediaUploadRepository,
    mediaUploadService,
    mediaUploadController,
    mediaUploadRoutes,
  };
};
