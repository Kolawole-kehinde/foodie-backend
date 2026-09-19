import type { RedisClient } from "../../../database/redis/client.js";

// get    → Redis GET
// set    → Redis SET + TTL
// remove → Redis DEL

type PermissionCacheDependencies = {
  redis: RedisClient;
};

// Permissions are cached for 15 minutes
const PERMISSION_CACHE_TTL = 60 * 15;

const getPermissionCacheKey = (userId: string) => `auth:permissions:${userId}`;

export const createPermissionCache = ({
  redis,
}: PermissionCacheDependencies) => {
  // Get a user's permissions from Redis.
  // Returns null when the permissions are not cached.
  const get = async (userId: string): Promise<string[] | null> => {
    const key = getPermissionCacheKey(userId);

    const cachedPermissions = await redis.get(key);

    console.log(
      cachedPermissions ? "Permission cache HIT" : "Permission cache MISS",
    );

    if (!cachedPermissions) {
      return null;
    }

    return JSON.parse(cachedPermissions) as string[];
  };

  // Store a user's permissions in Redis.
  const set = async (userId: string, permissions: string[]): Promise<void> => {
    const key = getPermissionCacheKey(userId);

    await redis.set(
      key,
      JSON.stringify(permissions),
      "EX",
      PERMISSION_CACHE_TTL,
    );
  };

  // Remove a user's cached permissions.
  // Used when the user's authorization data changes.
  const remove = async (userId: string): Promise<void> => {
    const key = getPermissionCacheKey(userId);

    await redis.del(key);
  };

  return {
    get,
    set,
    remove,
  };
};

export type PermissionCache = ReturnType<typeof createPermissionCache>;
