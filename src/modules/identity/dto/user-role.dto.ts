export type AssignUserRoleDto = {
  userId: string;
  roleId: string;
};

export type RemoveUserRoleDto = {
  userId: string;
  roleId: string;
};

export type UserRoleResponseDto = {
  userId: string;
  roleId: string;
  role: {
    id: string;
    name: string;
    description: string | null;
  };
};