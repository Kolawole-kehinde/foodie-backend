import type { UserRepository } from "../repositories/user.repository.js";


type UserServiceDependencies = {
     userRepository: UserRepository
 };


export const createUserService = ({ userRepository,}: UserServiceDependencies) => {

  const getAllUsers = async () => {
    return userRepository.findAll();
  };

  const getUserById = async (userId: string) => {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  };

  return { 
    getAllUsers,
     getUserById 
    };
};
export type UserService = ReturnType<typeof createUserService>;
