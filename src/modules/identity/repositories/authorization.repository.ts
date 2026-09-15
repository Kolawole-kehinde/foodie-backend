import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createAuthorizationRepository = (db: DatabaseClient) => {


  // Get all roles assigned to a user.
  // Relationship: User → UserRole → Role
  const getUserRoles = async (userId: string) => {
    return db.userRole.findMany({
      where: {
        userId,
      },
      include: {
        role: true,
      },
    });
  };

  // Get all permissions assigned to a user through their roles.
  // Relationship: User → UserRole → Role → RolePermission → Permission
  const getUserPermissions = async (userId: string) => {
    return db.userRole.findMany({
      where: {
        userId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });
  };

  // Check whether a user has a specific permission.
  // Relationship: User → UserRole → Role → RolePermission → Permission
  // true/false for a specific permission
  const hasPermission = async (userId: string,permissionName: string): Promise<boolean> => {
    const count = await db.permission.count({
      where: {
        name: permissionName,
        roles: {
          some: {
            role: {
              users: {
                some: {
                  userId,
                },
              },
            },
          },
        },
      },
    });

    return count > 0;
  };

  return {
    getUserRoles,
    getUserPermissions,
    hasPermission,
  };
};

export type AuthorizationRepository = ReturnType< typeof createAuthorizationRepository>;
