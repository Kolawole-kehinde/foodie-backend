import { Router, type RequestHandler } from "express";
import type { PermissionController } from "../controllers/permission.controller.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import { permissionIdSchema } from "../validators/permission.validation.js";


type CreatePermissionRoutesDependencies = {
  permissionController: PermissionController;
  authenticate: RequestHandler;
  authorizePermission: (requiredPermission: string) => RequestHandler;
};

export const createPermissionRoutes = ({
  permissionController,
  authenticate,
  authorizePermission,
}: CreatePermissionRoutesDependencies) => {

  const router = Router();

  router.get(
    "/",
    authenticate,
    authorizePermission("permissions.read"),
    permissionController.getAllPermissions,
  );

  router.get(
    "/:permissionId",
    authenticate,
    validate(permissionIdSchema, "params"),
    authorizePermission("permissions.read"),
    permissionController.getPermissionById,
  );
  return router;
};
export type PermissionRoutes = ReturnType<typeof createPermissionRoutes>;
