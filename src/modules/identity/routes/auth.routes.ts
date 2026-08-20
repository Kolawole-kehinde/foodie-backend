import { Router } from "express";

import type { AuthController } from "../controllers/auth.controller.js";
import { registerSchema } from "../validators/register.validator.js";
import { rateLimit } from "../../../shared/rate-limit/rate-limit.middleware.js";
import { registrationRateLimitPolicy } from "../middleware/registration-rate-limit.policy.js";
import { validate } from "../../../shared/rate-limit/middleware/validate.middleware.js";


type CreateAuthRoutesDependencies = {
  authController: AuthController;
};

export const createAuthRoutes = ({
  authController,
}: CreateAuthRoutesDependencies) => {
  const router = Router();

//  router.post(
//   "/register",

//   // Protect the endpoint itself
//   rateLimit({
//     policy: registrationIpAbusePolicy,
//   }),

//   // Validate the request
//   validate(registerSchema),

//   // Apply registration-specific limits
//   rateLimit({
//     policy: registrationRateLimitPolicy,
//   }),

//   authController.register
// );

router.post(
  "/register",
  validate(registerSchema),

  rateLimit({
    rules: registrationRateLimitPolicy,
  }),

  authController.register
);
  return router;
};

export type AuthRoutes = ReturnType<typeof createAuthRoutes>;