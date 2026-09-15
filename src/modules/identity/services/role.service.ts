import type { RoleName } from "@prisma/client";

import type { RoleRepository } from "../repositories/role.repository.js";

type CreateRoleInput = {
  name: RoleName;
  description?: string;
};

type UpdateRoleInput = {
  name?: RoleName;
  description?: string;
};

type RoleServiceDependencies = {
  roleRepository: RoleRepository;
};

const protectedRoles: RoleName[] = ["ADMIN", "USER", "CUSTOMER_SUPPORT"];

export const createRoleService = ({roleRepository}: RoleServiceDependencies) => {

  const createRole = async ({ name, description }: CreateRoleInput) => {
    const existingRole = await roleRepository.getRoleByName(name);

    if (existingRole) {
      throw new Error(`Role "${name}" already exists`);
    }

    return roleRepository.create(name, description);
  };

  const getAllRoles = async () => {
    return roleRepository.getAllRoles();
  };

  const getRoleById = async (roleId: string) => {
    const role = await roleRepository.getRoleById(roleId);

    if (!role) {
      throw new Error("Role not found");
    }

    return role;
  };

  const getRoleByName = async (name: RoleName) => {
    return roleRepository.getRoleByName(name);
  };

  const updateRole = async (roleId: string, data: UpdateRoleInput) => {
    const existingRole = await roleRepository.getRoleById(roleId);

    if (!existingRole) {
      throw new Error("Role not found");
    }

    if (data.name && data.name !== existingRole.name) {
      const roleWithSameName = await roleRepository.getRoleByName(data.name);

      if (roleWithSameName) {
        throw new Error(`Role "${data.name}" already exists`);
      }
    }

    if (protectedRoles.includes(existingRole.name) &&data.name &&data.name !== existingRole.name) {
      throw new Error(
        `Protected role "${existingRole.name}" cannot be renamed`,
      );
    }

    return roleRepository.updateRole(roleId, data);
  };

  const deleteRole = async (roleId: string) => {
    const existingRole = await roleRepository.getRoleById(roleId);

    if (!existingRole) {
      throw new Error("Role not found");
    }

    if (protectedRoles.includes(existingRole.name)) {
      throw new Error(
        `Protected role "${existingRole.name}" cannot be deleted`,
      );
    }

    return roleRepository.deleteRole(roleId);
  };

  return {
    createRole,
    getAllRoles,
    getRoleById,
    getRoleByName,
    updateRole,
    deleteRole,
  };
};

export type RoleService = ReturnType<typeof createRoleService>;
