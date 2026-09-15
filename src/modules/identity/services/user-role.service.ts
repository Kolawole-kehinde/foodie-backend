import type { RoleRepository } from "../repositories/role.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { UserRoleRepository } from "../repositories/user-role.repository.js";
import type { AuthorizationCacheService } from "./authorization-cache.service.js";

type UserRoleServiceDependencies = {
  userRepository: UserRepository;
  roleRepository: RoleRepository;
  userRoleRepository: UserRoleRepository;
  authorizationCacheService: AuthorizationCacheService;
};

export const createUserRoleService = ({
  userRepository,
  roleRepository,
  userRoleRepository,
  authorizationCacheService,
}: UserRoleServiceDependencies) => {


  const assignRole = async (userId: string, roleId: string) => {
  const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const role = await roleRepository.getRoleById(roleId);

    if (!role) {
      throw new Error("Role not found");
    }

    const existingUserRole = await userRoleRepository.findByUserAndRole(
      userId,
      roleId,
    );

    if (existingUserRole) {
      throw new Error("User already has this role");
    }

    const userRole = await userRoleRepository.assignRole(userId, roleId);

    await authorizationCacheService.invalidateUser(userId);

    return userRole;
  };

  const getUserRoles = async (userId: string) => {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    return userRoleRepository.findUserRoles(userId);
  };

  const removeRole = async (userId: string, roleId: string) => {
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const role = await roleRepository.getRoleById(roleId);

    if (!role) {
      throw new Error("Role not found");
    }

    const existingUserRole = await userRoleRepository.findByUserAndRole(
      userId,
      roleId,
    );

    if (!existingUserRole) {
      throw new Error("User does not have this role");
    }

    await userRoleRepository.removeRole(userId, roleId);

    await authorizationCacheService.invalidateUser(userId);
  };

  return {
    assignRole,
    getUserRoles,
    removeRole,
  };
};

export type UserRoleService = ReturnType<typeof createUserRoleService>;
