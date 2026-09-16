export type AssignRolePermissionDto = {
  permissionId: string;
};

export type RolePermissionResponseDto = {
  roleId: string;
  permissionId: string;
  permission: {
    id: string;
    name: string;
    resource: string;
    action: string;
    description: string | null;
  };
};