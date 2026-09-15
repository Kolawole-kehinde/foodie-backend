import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { RequestHandler } from "express";
import type { CreateRoleDto, UpdateRoleDto } from "../dto/role.dto.js";
import type { RoleService } from "../services/role.service.js";

export type RoleController = {
  createRole: RequestHandler;
  getAllRoles: RequestHandler;
  getRoleById: RequestHandler;
  updateRole: RequestHandler;
  deleteRole: RequestHandler;
};

type CreateRoleControllerDependencies = {
  roleService: RoleService;
};

export const createRoleController = ({ roleService,}: CreateRoleControllerDependencies): RoleController => {

  const createRole = asyncHandler(async (req, res) => {
    const dto: CreateRoleDto = req.body;

    const result = await roleService.createRole(dto);

    return res.status(201).json(result);
  });

  const getAllRoles = asyncHandler(async (_req, res) => {
    const result = await roleService.getAllRoles();

    return res.status(200).json(result);
  });

  const getRoleById = asyncHandler(async (req, res) => {
    const roleId = req.params.roleId;

    if (typeof roleId !== "string" || !roleId) {
      throw new BadRequestError("Role ID is required");
    }

    const result = await roleService.getRoleById(roleId);

    return res.status(200).json(result);
  });

  const updateRole = asyncHandler(async (req, res) => {
    const roleId = req.params.roleId;

    if (typeof roleId !== "string" || !roleId) {
      throw new BadRequestError("Role ID is required");
    }

    const dto: UpdateRoleDto = req.body;
    const result = await roleService.updateRole(roleId, dto);

    return res.status(200).json(result);
  });

  const deleteRole = asyncHandler(async (req, res) => {
    const roleId = req.params.roleId;

    if (typeof roleId !== "string" || !roleId) {
      throw new BadRequestError("Role ID is required");
    }

    await roleService.deleteRole(roleId);

    return res.status(200).json({
      message: "Role deleted successfully",
    });
  });

  return {
    createRole,
    getAllRoles,
    getRoleById,
    updateRole,
    deleteRole,
  };
};
