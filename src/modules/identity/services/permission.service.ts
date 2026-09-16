
import type { PermissionRepository } from "../repositories/permission.repository.js";

type PermissionServiceDependencies = {
  permissionRepository: PermissionRepository;
};

export const createPermissionService = ({ permissionRepository}: PermissionServiceDependencies) => {
  const getAllPermissions = async () => {
    return permissionRepository.getAllPermissions();
  };

  const getPermissionById = async (permissionId: string) => {
    const permission =
      await permissionRepository.getPermissionById(permissionId);

    if (!permission) {
      throw new Error("Permission not found");
    }

    return permission;
  };

  return {
    getAllPermissions,
    getPermissionById,
  };
};

export type PermissionService = ReturnType<typeof createPermissionService>;
