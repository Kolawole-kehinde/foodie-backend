import { Router } from "express";
import type { AuthController } from "../controllers/auth.controller.js";
import { registerSchema } from "../validators/register.validator.js";
import { rateLimit } from "../../../shared/rate-limit/rate-limit.middleware.js";
import { registrationRateLimitPolicy } from "../middleware/registration-rate-limit.policy.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import { verifyEmailSchema } from "../validators/verify-email.validator.js";
import { loginSchema } from "../validators/login.validator.js";
import { loginRateLimitPolicy } from "../middleware/login-rate-limit.policy.js";
import { verifyEmailRateLimitPolicy } from "../middleware/verify-email-rate-limit.policy.js";
import { authenticate } from "../middleware/authentication.js";




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
  rateLimit({
    rules: registrationRateLimitPolicy,
  }),
  authController.register
);

router.post(
  "/verify-email",
  validate(verifyEmailSchema),
    rateLimit({
    rules: verifyEmailRateLimitPolicy,
  }),

  authController.verifyEmail
);

router.post(
  "/login",
  validate(loginSchema),
  rateLimit({
    rules: loginRateLimitPolicy
  }),
  authController.login
);

router.post(
  "/refresh",
  authController.refresh,
);

router.post(
  "/logout",
  authenticate,
  authController.logout,
);

router.post(
  "/logout-all-devices",
  authenticate,
  authController.logoutAllDevices,
);

  return router;
};

export type AuthRoutes = ReturnType<typeof createAuthRoutes>;