import type { DatabaseClient } from "../../database/prisma/types.js";
import type { RequestHandler } from "express";

import { createProfileRepository } from "./repositories/profile.repository.js";
import { createProfileService } from "./services/profile.service.js";
import { createProfileController } from "./controllers/controller.js";
import { createProfileRoutes } from "./routes/routes.js";


type CreateProfileDependencies = {
  db: DatabaseClient;
  authenticate: RequestHandler;
};

export const createProfileDependencies = ({
  db,
  authenticate,
}: CreateProfileDependencies) => {
  const profileRepository = createProfileRepository(db);

  const profileService = createProfileService({
    profileRepository,
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
