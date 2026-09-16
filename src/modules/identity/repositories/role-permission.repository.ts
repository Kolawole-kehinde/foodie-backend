import type { DatabaseClient } from "../../../database/prisma/types.js";



export const createRolePermissionRepository = (db: DatabaseClient) => {

    const findByRoleAndPermission = async(roleId: string, permissionId: string) =>{
     return db.rolePermission.findUnique({
        where:{
            roleId_permissionId:{
                roleId,
                permissionId
            }
        }
     })
    };

    const findRolePermissions = async(roleId: string) =>{
         return db.rolePermission.findMany({
            where:{
               roleId
            },
            include:{
                permission: true
            }
         })
    };

    const assignPermission = async(roleId: string, permissionId: string) =>{
          return db.rolePermission.create({
             data:{
                roleId,
                permissionId
             },
             include:{
                permission: true
             }
          })
    };

    const removePermission = async(roleId: string, permissionId: string) =>{
          return db.rolePermission.delete({
            where:{
                roleId_permissionId:{
                    roleId,
                    permissionId
                }
            }
          })
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


    return {
        findByRoleAndPermission,
        findRolePermissions,
        assignPermission,
        removePermission,
        getUserIdsByRoleId
    }
}

export type RolePermissionRepository = ReturnType<typeof createRolePermissionRepository>