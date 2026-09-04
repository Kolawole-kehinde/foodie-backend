import { Router, type RequestHandler } from "express";
import { registerSchema } from "../validators/register.validator.js";
import { rateLimit } from "../../../shared/rate-limit/rate-limit.middleware.js";
import { registrationRateLimitPolicy } from "../middleware/registration-rate-limit.policy.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import { verifyEmailSchema } from "../validators/verify-email.validator.js";
import { loginSchema } from "../validators/login.validator.js";
import { loginRateLimitPolicy } from "../middleware/login-rate-limit.policy.js";
import { verifyEmailRateLimitPolicy } from "../middleware/verify-email-rate-limit.policy.js";
import { forgotPasswordSchema } from "../validators/forgot-password.validator.js";
import { resetPasswordSchema } from "../validators/reset-password.validator.js";
import type { AuthController } from "../controllers/auth.controller.js";
import { passwordResetPolicy } from "../middleware/password-reset-limit-policy.js";
import { resetPasswordRateLimitPolicy } from "../middleware/reset-password-rateLimit-policy.js";






type CreateAuthRoutesDependencies = {
  authController: AuthController;
  authenticate: RequestHandler;
};

export const createAuthRoutes = ({ authController, authenticate}: CreateAuthRoutesDependencies) => {

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
  "/forgot-password",
  validate(forgotPasswordSchema),
  rateLimit({
    rules:passwordResetPolicy
  }),
  authController.forgotPassword,
);

router.post(
  "/reset-password",
  validate(resetPasswordSchema),
  rateLimit({
   rules:resetPasswordRateLimitPolicy
  }),
  authController.resetPassword,
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

router.get(
  "/sessions",
  authenticate,
  authController.getSessions
);

router.delete(
  "/sessions/:sessionId",
  authenticate,
  authController.revokeSession
);




  return router;
};



export type AuthRoutes = ReturnType<typeof createAuthRoutes>;