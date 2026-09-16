import type { RequestHandler } from "express"
import type { RolePermissionService } from "../services/role-permission.service.js"




export type RolePermissionController = {
    assignPermission: RequestHandler,
    getRolePermissions: RequestHandle,
    removePermission: RequestHandle,
}

type RolePermissionControllerDependencies = {
   rolePermissionService: RolePermissionService
}


export const createRoleController = ({rolePermissionService}:RolePermissionControllerDependencies): RolePermissionController => {

}