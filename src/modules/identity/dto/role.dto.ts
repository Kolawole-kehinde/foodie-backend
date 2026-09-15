import type { RoleName } from "@prisma/client";

export type CreateRoleDto = {
  name: RoleName;
  description?: string;
};

export type UpdateRoleDto = {
  name?: RoleName;
  description?: string;
};

export type RoleResponseDto = {
  id: string;
  name: RoleName;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};