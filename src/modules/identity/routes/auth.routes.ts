import { Router } from "express";

import type { AuthController } from "../controllers/auth.controller.js";
import { registerSchema } from "../validators/register.validator.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";

type CreateAuthRoutesDependencies = {
  authController: AuthController;
};

export const createAuthRoutes = ({
  authController,
}: CreateAuthRoutesDependencies) => {
  const router = Router();

  router.post(
    "/register",
    validate(registerSchema),
    authController.register
  );

  return router;
};

export type AuthRoutes = ReturnType<typeof createAuthRoutes>;