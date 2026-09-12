import type { DatabaseClient } from "../../database/prisma/types.js";
import type { RequestHandler } from "express";
import type { S3Service } from "../../infrastructure/s3/s3.service.js";
import { createProfileRepository } from "./repositories/profile.repository.js";
import { createProfileService } from "./services/profile.service.js";
import { createProfileController } from "./controllers/controller.js";
import { createProfileRoutes } from "./routes/routes.js";


type CreateProfileDependencies = {
  db: DatabaseClient;
  s3Service: S3Service;
  authenticate: RequestHandler;
};

export const createProfileDependencies = ({
  db,
  s3Service,
  authenticate,
}: CreateProfileDependencies) => {
  const profileRepository = createProfileRepository(db);

  const profileService = createProfileService({
    profileRepository,
    s3Service,
  });

  const profileController = createProfileController({
    profileService,
  });

  const profileRoutes = createProfileRoutes({
    profileController,
    authenticate,
  });

  return {
    profileRepository,
    profileService,
    profileController,
    profileRoutes,
  };
};
