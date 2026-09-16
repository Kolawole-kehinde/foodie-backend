import { Router, type RequestHandler } from "express";
import { validate } from "../../../shared/middlewares/validate.js";
import type { PermissionController } from "../controllers/permission.controller.js";
import { permissionIdSchema } from "../validation/permission.validation.js";
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
