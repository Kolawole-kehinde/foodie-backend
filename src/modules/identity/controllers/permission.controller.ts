import type { RequestHandler } from "express";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { PermissionService } from "../services/permission.service.js";



export type PermissionController = {
  getAllPermissions: RequestHandler;
  getPermissionById: RequestHandler;
};


type PermissionControllerDependencies = {
  permissionService: PermissionService;
};


export const createPermissionController = ({ permissionService,}: PermissionControllerDependencies): PermissionController => {

  const getAllPermissions = asyncHandler(async (_req, res) => {

    const permissions = await permissionService.getAllPermissions();
    return res.status(200).json(permissions);
  });

  const getPermissionById = asyncHandler(async (req, res) => {

    const permissionId = req.params.permissionId;

    if (typeof permissionId !== "string" || !permissionId) {
      throw new Error("Permission ID is required");
    }
    const permission = await permissionService.getPermissionById(permissionId);
    return res.status(200).json(permission);
  });
  return { 
    getAllPermissions,
    getPermissionById
 };
};


export type PermissionControllerType = ReturnType<typeof createPermissionController>;
