import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createUserRoleRepository = (db: DatabaseClient) => {
  const findByUserAndRole = async (userId: string, roleId: string) => {
    return db.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  };

  const findUserRoles = async (userId: string) => {
    return db.userRole.findMany({
      where: {
        userId,
      },
      include: {
        role: true,
      },
    });
  };

  const assignRole = async (userId: string, roleId: string) => {
    return db.userRole.create({
      data: {
        userId,
        roleId,
      },
      include: {
        role: true,
      },
    });
  };

  const removeRole = async (userId: string, roleId: string) => {
    return db.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  };

  return {
    findByUserAndRole,
    findUserRoles,
    assignRole,
    removeRole,
  };
};

export type UserRoleRepository = ReturnType<typeof createUserRoleRepository>;
