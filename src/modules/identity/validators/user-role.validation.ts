import { z } from "../../../docs/zod-openapi.js";

export const assignUserRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  roleId: z.string().min(1, "Role ID is required"),
});

export const removeUserRoleSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  roleId: z.string().min(1, "Role ID is required"),
});

export const userRoleParamsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  roleId: z.string().min(1, "Role ID is required"),
});