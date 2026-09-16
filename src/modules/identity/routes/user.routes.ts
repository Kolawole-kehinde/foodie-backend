import { Router, type RequestHandler } from "express";
import { validate } from "../../../shared/middlewares/validate.js";
import type { UserController } from "../controllers/user.controller.js";
import { userIdSchema } from "../validation/user.validation.js";
type CreateUserRoutesDependencies = {
  userController: UserController;
  authenticate: RequestHandler;
  authorizePermission: (requiredPermission: string) => RequestHandler;
};
export const createUserRoutes = ({
  userController,
  authenticate,
  authorizePermission,
}: CreateUserRoutesDependencies) => {
  const router = Router();
  router.get(
    "/",
    authenticate,
    authorizePermission("users.read"),
    userController.getAllUsers,
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
