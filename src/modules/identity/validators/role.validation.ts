import { z } from "zod";
import { createRoleSchema, updateRoleSchema } from "../dto/role.dto.js";

export const roleIdSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
});

export const validateCreateRole = (data: unknown) => {
  return createRoleSchema.parse(data);
};

export const validateUpdateRole = (data: unknown) => {
  return updateRoleSchema.parse(data);
};

export const validateRoleId = (data: unknown) => {
  return roleIdSchema.parse(data);
};