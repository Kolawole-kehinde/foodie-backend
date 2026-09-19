import { Router, type RequestHandler } from "express";
import type { UserController } from "../controllers/user.controller.js";
import { userIdSchema } from "../validators/user.validation.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";

type CreateUserRoutesDependencies = {
  userController: UserController;
  authenticate: RequestHandler;
  authorizePermission: (requiredPermission: string) => RequestHandler;
};
export const createUserRoutes = ({
  userController,
  authenticate,
  authorizePermission,
}: CreateUserRoutesDependencies): Router => {
  const router = Router();
  router.get(
    "/",
    authenticate,
    authorizePermission("users.read"),
    userController.getAllUsers,
  );

  router.get(
    "/me", 
    authenticate, 
    userController.getMe
);

  router.get(
    "/:userId",
    authenticate,
    validate(userIdSchema, "params"),
    authorizePermission("users.read"),
    userController.getUserById,
  );
  return router;
};
export type UserRoutes = ReturnType<typeof createUserRoutes>;
