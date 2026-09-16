import type { RequestHandler } from "express";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { UserResponseDto } from "../dto/user.dto.js";
import type { UserService } from "../services/user.service.js";


export type UserController = {
  getAllUsers: RequestHandler;
  getUserById: RequestHandler;
};


type UserControllerDependencies = { 
    userService: UserService
 };


export const createUserController = ({ userService,}: UserControllerDependencies): UserController => {

  const getAllUsers = asyncHandler(async (_req, res) => {
    const users: UserResponseDto[] = await userService.getAllUsers();
    return res.status(200).json(users);
  });
  
  const getUserById = asyncHandler(async (req, res) => {
    const userId = req.params.userId as string;
    const user: UserResponseDto = await userService.getUserById(userId);
    return res.status(200).json(user);
  });
  return { getAllUsers, getUserById };
};
export type UserControllerType = ReturnType<typeof createUserController>;
