import { z } from "zod";

export const assignRolePermissionSchema = z.object({
  permissionId: z.string().min(1, "Permission ID is required"),
});

export const rolePermissionParamsSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  permissionId: z.string().min(1, "Permission ID is required"),
});