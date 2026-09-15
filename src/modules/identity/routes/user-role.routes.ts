import { Router } from "express";
import type { RequestHandler } from "express";
import type { UserRoleController } from "../controllers/user-role.controller.js";

type CreateUserRoleRoutesDependencies = {
  userRoleController: UserRoleController;
  authenticate: RequestHandler;
  authorizePermission: (requiredPermission: string) => RequestHandler;
};

export const createUserRoleRoutes = ({
  userRoleController,
  authenticate,
  authorizePermission,
}: CreateUserRoleRoutesDependencies) => {
  const router = Router();

  router.post(
    "/:userId/roles",
    authenticate,
    authorizePermission("users.roles.assign"),
    userRoleController.assignRole,
  );

  router.get(
    "/:userId/roles",
    authenticate,
    authorizePermission("users.roles.read"),
    userRoleController.getUserRoles,
  );

  router.delete(
    "/:userId/roles/:roleId",
    authenticate,
    authorizePermission("users.roles.remove"),
    userRoleController.removeRole,
  );

  return router;
};

export type UserRoleRoutes = ReturnType<typeof createUserRoleRoutes>;
