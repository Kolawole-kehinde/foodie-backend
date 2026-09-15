import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z.string().trim().min(1, "Description cannot be empty").optional(),
});

export const updateRoleSchema = z.object({
    name: z.string().min(1, "Role name cannot be empty").optional(),
    description: z.string().trim().min(1, "Description cannot be empty").optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const roleIdSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
});
