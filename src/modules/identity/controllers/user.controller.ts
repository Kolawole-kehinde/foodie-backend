import type { RequestHandler } from "express";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { UserResponseDto } from "../dto/user.dto.js";
import type { UserService } from "../services/user.service.js";

export type UserController = {
  getAllUsers: RequestHandler;
  getUserById: RequestHandler;
  getMe: RequestHandler;
};

type UserControllerDependencies = {
  userService: UserService;
};

export const createUserController = ({
  userService,
}: UserControllerDependencies): UserController => {
  const getAllUsers = asyncHandler(async (_req, res) => {
    const users = await userService.getAllUsers();

    const response: UserResponseDto[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map(({ role }) => ({
        id: role.id,
        name: role.name,
        description: role.description,
      })),
    }));

    return res.status(200).json(response);
  });

  const getUserById = asyncHandler(async (req, res) => {
    const userId = req.params.userId as string;

    const user = await userService.getUserById(userId);

    const response: UserResponseDto = {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map(({ role }) => ({
        id: role.id,
        name: role.name,
        description: role.description,
      })),
    };

    return res.status(200).json(response);
  });

  const getMe = asyncHandler(async (req, res) => {
    if (!req.user) {
      throw new Error("Authentication required");
    }

    const user = await userService.getMe(req.user.id);

    const response: UserResponseDto = {
      id: user.id,
      email: user.email,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map(({ role }) => ({
        id: role.id,
        name: role.name,
        description: role.description,
      })),
    };

    return res.status(200).json(response);
  });

  return {
    getAllUsers,
    getUserById,
    getMe,
  };
};

export type UserControllerType = ReturnType<typeof createUserController>;
