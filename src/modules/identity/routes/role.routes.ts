import { Router } from "express";
import type { RequestHandler } from "express";
import type { RoleController } from "../controllers/role.controller.js";

type CreateRoleRoutesDependencies = {
  roleController: RoleController;
  authenticate: RequestHandler;
  authorizePermission: (requiredPermission: string) => RequestHandler;
};

export const createRoleRoutes = ({
  roleController,
  authenticate,
  authorizePermission,
}: CreateRoleRoutesDependencies): Router => {
  const router = Router();

  router.post(
    "/",
    authenticate,
    authorizePermission("roles.create"),
    roleController.createRole,
  );

  router.get(
    "/",
    authenticate,
    authorizePermission("roles.read"),
    roleController.getAllRoles,
  );

  router.get(
    "/:roleId",
    authenticate,
    authorizePermission("roles.read"),
    roleController.getRoleById,
  );

  router.patch(
    "/:roleId",
    authenticate,
    authorizePermission("roles.update"),
    roleController.updateRole,
  );

  router.delete(
    "/:roleId",
    authenticate,
    authorizePermission("roles.delete"),
    roleController.deleteRole,
  );

  return router;
};

export type RoleRoutes = ReturnType<typeof createRoleRoutes>;
