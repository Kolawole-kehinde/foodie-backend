import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { RequestHandler } from "express";
import type { UserRoleService } from "../services/user-role.service.js";

export type UserRoleController = {
  assignRole: RequestHandler;
  getUserRoles: RequestHandler;
  removeRole: RequestHandler;
};

type UserRoleControllerDependencies = {
  userRoleService: UserRoleService;
};

export const createUserRoleController = ({ userRoleService,}: UserRoleControllerDependencies): UserRoleController => {
  const assignRole = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    if (typeof userId !== "string" || !userId) {
      throw new BadRequestError("User ID is required");
    }

    const roleId = req.body.roleId;

    if (typeof roleId !== "string" || !roleId) {
      throw new BadRequestError("Role ID is required");
    }

    const result = await userRoleService.assignRole(userId, roleId);

    return res.status(201).json(result);
  });

  const getUserRoles = asyncHandler(async (req, res) => {
    const userId = req.params.userId;

    if (typeof userId !== "string" || !userId) {
      throw new BadRequestError("User ID is required");
    }

    const result = await userRoleService.getUserRoles(userId);

    return res.status(200).json(result);
  });

  const removeRole = asyncHandler(async (req, res) => {
    const userId = req.params.userId;
    const roleId = req.params.roleId;

    if (typeof userId !== "string" || !userId) {
      throw new BadRequestError("User ID is required");
    }

    if (typeof roleId !== "string" || !roleId) {
      throw new BadRequestError("Role ID is required");
    }

    await userRoleService.removeRole(userId, roleId);

    return res.status(200).json({
      message: "Role removed from user successfully",
    });
  });

  return {
    assignRole,
    getUserRoles,
    removeRole,
  };
};

export type UserRoleControllerType = ReturnType<typeof createUserRoleController>;
