import { Router, type RequestHandler } from "express";
import type { RolePermissionController } from "../controllers/role-permission.controller.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import { assignRolePermissionSchema, roleIdSchema, rolePermissionParamsSchema } from "../validators/role-permission.validation.js";


type CreateRolePermissionRoutesDependencies = {
  rolePermissionController: RolePermissionController;
  authenticate: RequestHandler;
  authorizePermission: (requiredPermission: string) => RequestHandler;
};

export const createRolePermissionRoutes = ({
  rolePermissionController,
  authenticate,
  authorizePermission,
}: CreateRolePermissionRoutesDependencies): Router => {
  const router = Router();

  router.post(
    "/:roleId/permissions",
    authenticate,
    validate(roleIdSchema, "params"),
    validate(assignRolePermissionSchema, "body"),
    authorizePermission("roles.permissions.assign"),
    rolePermissionController.assignPermission,
  );

  router.get(
    "/:roleId/permissions",
    authenticate,
    validate(roleIdSchema, "params"),
    authorizePermission("roles.permissions.read"),
    rolePermissionController.getRolePermissions,
  );

  router.delete(
    "/:roleId/permissions/:permissionId",
    authenticate,
    validate(rolePermissionParamsSchema, "params"),
    authorizePermission("roles.permissions.remove"),
    rolePermissionController.removePermission,
  );

  return router;
};

export type RolePermissionRoutes = ReturnType<typeof createRolePermissionRoutes>;
