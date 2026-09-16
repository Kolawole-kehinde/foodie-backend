import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createPermissionRepository = (db: DatabaseClient) => {
  const getAllPermissions = async () => {
    return db.permission.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  const getPermissionById = async (permissionId: string) => {
    return db.permission.findUnique({
      where: {
        id: permissionId,
      },
    });
  };

  const getPermissionByName = async (name: string) => {
    return db.permission.findUnique({
      where: {
        name,
      },
    });
  };

  return {
    getAllPermissions,
    getPermissionById,
    getPermissionByName,
  };
};

export type PermissionRepository = ReturnType< typeof createPermissionRepository>;
