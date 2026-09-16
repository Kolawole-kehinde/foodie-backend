import type { RequestHandler } from "express";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import type { AssignRolePermissionDto } from "../dto/role-permission.dto.js";
import type { RolePermissionService } from "../services/role-permission.service.js";

export type RolePermissionController = {
  assignPermission: RequestHandler;
  getRolePermissions: RequestHandler;
  removePermission: RequestHandler;
};

type RolePermissionControllerDependencies = {
  rolePermissionService: RolePermissionService;
};

export const createRolePermissionController = ({
  rolePermissionService,
}: RolePermissionControllerDependencies): RolePermissionController => {

  const assignPermission = asyncHandler(async (req, res) => {
    const roleId = req.params.roleId;

    if (typeof roleId !== "string" || !roleId) {
      throw new BadRequestError("Role ID is required");
    }

    const dto: AssignRolePermissionDto = req.body;

    const permissionId = dto.permissionId;

    if (typeof permissionId !== "string" || !permissionId) {
      throw new BadRequestError("Permission ID is required");
    }

    const result = await rolePermissionService.assignPermission(
      roleId,
      permissionId,
    );

    return res.status(201).json(result);
  });



  const getRolePermissions = asyncHandler(async (req, res) => {
    const roleId = req.params.roleId;

    if (typeof roleId !== "string" || !roleId) {
      throw new BadRequestError("Role ID is required");
    }

    const result = await rolePermissionService.getRolePermissions(roleId);

    return res.status(200).json(result);
  });
  

  const removePermission = asyncHandler(async (req, res) => {
    const roleId = req.params.roleId;
    const permissionId = req.params.permissionId;

    if (typeof roleId !== "string" || !roleId) {
      throw new BadRequestError("Role ID is required");
    }

    if (typeof permissionId !== "string" || !permissionId) {
      throw new BadRequestError("Permission ID is required");
    }

    await rolePermissionService.removePermission(roleId, permissionId);

    return res.status(200).json({
      message: "Permission removed from role successfully",
    });
  });

  return {
    assignPermission,
    getRolePermissions,
    removePermission,
  };
};

export type RolePermissionControllerType = ReturnType<typeof createRolePermissionController>;
