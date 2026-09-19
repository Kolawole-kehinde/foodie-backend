import { Router, type RequestHandler } from "express";
import { updateProfileSchema } from "../schemas/profile.schema.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import type { ProfileController } from "../controllers/controller.js";

type CreateProfileRoutesDependencies = {
  profileController: ProfileController;
  authenticate: RequestHandler;
};

export const createProfileRoutes = ({
  profileController,
  authenticate,
}: CreateProfileRoutesDependencies): Router => {
  const router = Router();

  router.get(
    "/profile",
    authenticate,
    profileController.getProfile,
  );

  router.patch(
    "/profile",
    authenticate,
    validate(updateProfileSchema),
    profileController.updateProfile,
  );

  return router;
};