import type { AuthorizationRepository } from "../repositories/authorization.repository.js";

type AuthorizationServiceDependencies = {
  authorizationRepository: AuthorizationRepository;
};

export const createAuthorizationService = ({ authorizationRepository,}: AuthorizationServiceDependencies) => {
 
   // Get all roles assigned to a user.
  const getUserRoles = async (userId: string) => {
    return authorizationRepository.getUserRoles(userId);
  };

  // Get all unique permission names assigned to a user.
  // A user can have multiple roles, and multiple roles can contain

  const getUserPermissions = async (userId: string): Promise<string[]> => {
    const userRoles = await authorizationRepository.getUserPermissions(userId);

    const permissionNames = userRoles.flatMap((userRole) =>
      userRole.role.permissions.map(
        (rolePermission) => rolePermission.permission.name,
      ),
    );

    return [...new Set(permissionNames)];
  };

  // Check whether a user has a specific permission.
  const hasPermission = async (userId: string, permissionName: string,): Promise<boolean> => {
    return authorizationRepository.hasPermission(userId, permissionName);
  };

  return {
    getUserRoles,
    getUserPermissions,
    hasPermission,
  };
};

export type AuthorizationService = ReturnType < typeof createAuthorizationService>;
