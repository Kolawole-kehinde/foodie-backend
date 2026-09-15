import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1, "Role name is required"),
  description: z
    .string()
    .trim()
    .min(1, "Description cannot be empty")
    .optional(),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;

export const updateRoleSchema = z
  .object({
    name: z.string().min(1, "Role name cannot be empty").optional(),
    description: z
      .string()
      .trim()
      .min(1, "Description cannot be empty")
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateRoleDto = z.infer<typeof updateRoleSchema>;

export const roleResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type RoleResponseDto = z.infer<typeof roleResponseSchema>;