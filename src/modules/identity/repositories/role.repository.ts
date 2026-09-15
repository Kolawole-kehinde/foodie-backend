import type { RoleName, Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createRoleRepository = (db: DatabaseClient) => {


  const create = async (name: RoleName, description?: string,) => {
    return db.role.create({
      data: {
        name,
        description,
      },
    });
  };

  const getAllRoles = async () => {
    return db.role.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  const getRoleById = async (roleId: string) => {
    return db.role.findUnique({
      where: {
        id: roleId,
      },
    });
  };

  const getUserIdsByRoleId = async (roleId: string) => {
  const userRoles = await db.userRole.findMany({
    where: {
      roleId,
    },
    select: {
      userId: true,
    },
  });

  return userRoles.map(({ userId }) => userId);
};

  const getRoleByName = async (name: RoleName) => {
    return db.role.findUnique({
      where: {
        name,
      },
    });
  };

  const updateRole = async (roleId: string, data: Prisma.RoleUpdateInput,) => {
    return db.role.update({
      where: {
        id: roleId,
      },
      data,
    });
  };

  const deleteRole = async (roleId: string) => {
    return db.role.delete({
      where: {
        id: roleId,
      },
    });
  };

  return {
    create,
    getAllRoles,
    getRoleById,
    getRoleByName,
    updateRole,
    deleteRole,
    getUserIdsByRoleId,
  };
};

export type RoleRepository = ReturnType<typeof createRoleRepository>;