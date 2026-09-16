import type { PermissionRepository } from "../repositories/permission.repository.js";
import type { RoleRepository } from "../repositories/role.repository.js";
import type { RolePermissionRepository } from "../repositories/role-permission.repository.js";
import type { AuthorizationCacheService } from "./authorization-cache.service.js";

type RolePermissionServiceDependencies = {
  roleRepository: RoleRepository;
  permissionRepository: PermissionRepository;
  rolePermissionRepository: RolePermissionRepository;
  authorizationCacheService: AuthorizationCacheService;
};

export const createRolePermissionService = ({
  roleRepository,
  permissionRepository,
  rolePermissionRepository,
  authorizationCacheService,
}: RolePermissionServiceDependencies) => {
  const assignPermission = async (roleId: string, permissionId: string) => {
    const role = await roleRepository.getRoleById(roleId);

    if (!role) {
      throw new Error("Role not found");
    }

    const permission =
      await permissionRepository.getPermissionById(permissionId);

    if (!permission) {
      throw new Error("Permission not found");
    }

    const existingRolePermission =
      await rolePermissionRepository.findByRoleAndPermission(
        roleId,
        permissionId,
      );

    if (existingRolePermission) {
      throw new Error("Permission is already assigned to this role");
    }

    const rolePermission = await rolePermissionRepository.assignPermission(
      roleId,
      permissionId,
    );

    const affectedUserIds =
      await rolePermissionRepository.getUserIdsByRoleId(roleId);

    await authorizationCacheService.invalidateUsers(affectedUserIds);

    return rolePermission;
  };

  const getRolePermissions = async (roleId: string) => {
    
    const role = await roleRepository.getRoleById(roleId);

    if (!role) {
      throw new Error("Role not found");
    }

    return rolePermissionRepository.findRolePermissions(roleId);
  };

  const removePermission = async (roleId: string, permissionId: string) => {
    const role = await roleRepository.getRoleById(roleId);

    if (!role) {
      throw new Error("Role not found");
    }

    const permission =
      await permissionRepository.getPermissionById(permissionId);

    if (!permission) {
      throw new Error("Permission not found");
    }

    const existingRolePermission =
      await rolePermissionRepository.findByRoleAndPermission(
        roleId,
        permissionId,
      );

    if (!existingRolePermission) {
      throw new Error("Permission is not assigned to this role");
    }

    await rolePermissionRepository.removePermission(roleId, permissionId);

    const affectedUserIds =
      await rolePermissionRepository.getUserIdsByRoleId(roleId);

    await authorizationCacheService.invalidateUsers(affectedUserIds);
  };

  return {
    assignPermission,
    getRolePermissions,
    removePermission,
  };
};

export type RolePermissionService = ReturnType< typeof createRolePermissionService>;
