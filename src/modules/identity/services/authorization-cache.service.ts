import type { PermissionCache } from "../cache/permission.cache.js";

type AuthorizationCacheServiceDependencies = {
  permissionCache: PermissionCache;
};

export const createAuthorizationCacheService = ({
  permissionCache,
}: AuthorizationCacheServiceDependencies) => {
  const invalidateUser = async (userId: string) => {
    await permissionCache.remove(userId);
  };

  const invalidateUsers = async (userIds: string[]) => {
    if (userIds.length === 0) {
      return;
    }

    await Promise.all(userIds.map((userId) => permissionCache.remove(userId)));
  };

  return {
    invalidateUser,
    invalidateUsers,
  };
};

export type AuthorizationCacheService = ReturnType<
  typeof createAuthorizationCacheService
>;
