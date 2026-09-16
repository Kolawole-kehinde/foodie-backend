import { roleRepository } from "../identity.container.js"
import type { RolePermissionRepository } from "../repositories/role-permission.repository.js"
import type { RoleRepository } from "../repositories/role.repository.js"
import type { UserRepository } from "../repositories/user.repository.js"
import type { AuthorizationCacheService } from "./authorization-cache.service.js"

type RolePermissionServiceDependencies = {
    permissionRepository: RolePermissionRepository,
    RoleRepository : RoleRepository
    userRepository: UserRepository,
    authorizationCacheService: AuthorizationCacheService,
}


export const createRolePermissionService = ({
    permissionRepository,
    RoleRepository,
    userRepository,
    authorizationCacheService
}: RolePermissionServiceDependencies) =>{

  const assignPermission = async(roleId: string, permissionId: string) =>{
     const role = await roleRepository.getRoleById(roleId)

     if(!role){
         throw new Error("Role not found")
     }

     const permission = await permiss
  }


  return{
     assignPermission,
  }

}