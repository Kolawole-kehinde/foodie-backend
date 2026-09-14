import type { PermissionCache } from "../cache/permission.cache.js";
import type { AuthorizationRepository } from "../repositories/authorization.repository.js";

type AuthorizationServiceDependencies = {
  authorizationRepository: AuthorizationRepository;
  permissionCache: PermissionCache;
};

export const createAuthorizationService = ({authorizationRepository,permissionCache,}: AuthorizationServiceDependencies) => {
  
    // Get all roles assigned to a user.
    // Roles are currently retrieved directly from the repository.
  const getUserRoles = async (userId: string) => {
    return authorizationRepository.getUserRoles(userId);
  };

  // Get all unique permissions assigned to a user.
   /* Flow:
   * 1. Check Redis for cached permissions.
   * 2. If found, return them immediately.
   * 3. If not found, get permissions from PostgreSQL.
   * 4. Flatten and deduplicate the permissions.
   * 5. Store the permissions in Redis.
   * 6. Return the permissions.
   */

  const getUserPermissions = async ( userId: string,): Promise<string[]> => {
    // Check Redis first.
    const cachedPermissions = await permissionCache.get(userId);

    // Cache hit: avoid querying PostgreSQL.
    if (cachedPermissions !== null) {
      return cachedPermissions;
    }

    // Cache miss: retrieve permissions from PostgreSQL.
    const userRoles = await authorizationRepository.getUserPermissions(userId);

    // Flatten the nested role/permission relationship  into a simple list of permission names.
    const permissionNames = userRoles.flatMap((userRole) =>
      userRole.role.permissions.map(
        (rolePermission) => rolePermission.permission.name,
      ),
    );

    // Remove duplicate permissions when multiple roles grant the same permission.
    const uniquePermissions = [...new Set(permissionNames)];

    // Store the result in Redis for future authorization checks.
    await permissionCache.set(userId, uniquePermissions);

    return uniquePermissions;
  };

   // Check whether a user has a specific permission.
   // We use getUserPermissions() instead of querying the repository directly so this check automatically benefits from Redis caching.
   
  const hasPermission = async (userId: string,permissionName: string,): Promise<boolean> => {

    const permissions = await getUserPermissions(userId);
    return permissions.includes(permissionName);
  };

  return {
    getUserRoles,
    getUserPermissions,
    hasPermission,
  };
};

export type AuthorizationService = ReturnType<typeof createAuthorizationService>;
