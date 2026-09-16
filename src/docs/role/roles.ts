

import { createRoleSchema, updateRoleSchema } from "../../modules/identity/validators/role.validation.js";
import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

const CreateRoleRequest = registry.register(
  "CreateRoleRequest",
  createRoleSchema,
);

const UpdateRoleRequest = registry.register(
  "UpdateRoleRequest",
  updateRoleSchema,
);

const RoleResponse = registry.register(
  "RoleResponse",
  z.object({
    id: z.string().openapi({
      example: "cmt7imm3w0003vcyo999bhdm1",
    }),
    name: z.string().openapi({
      example: "EDITOR",
    }),
    description: z.string().nullable().openapi({
      example: "Content editor",
    }),
    createdAt: z.string().datetime().openapi({
      example: "2026-09-16T10:00:00.000Z",
    }),
    updatedAt: z.string().datetime().openapi({
      example: "2026-09-16T10:00:00.000Z",
    }),
  }),
);

const RolesResponse = registry.register(
  "RolesResponse",
  z.array(RoleResponse),
);

const RoleIdParams = registry.register(
  "RoleIdParams",
  z.object({
    roleId: z.string().openapi({
      example: "cmt7imm3w0003vcyo999bhdm1",
    }),
  }),
);

// Create role
registry.registerPath({
  method: "post",
  path: "/roles",
  tags: ["Role"],
  summary: "Create a role",
  description: "Creates a new role.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: CreateRoleRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Role created successfully.",
      content: {
        "application/json": {
          schema: RoleResponse,
        },
      },
    },
    400: {
      description: "Validation error or role already exists.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
  },
});

// Get all roles
registry.registerPath({
  method: "get",
  path: "/roles",
  tags: ["Role"],
  summary: "Get all roles",
  description: "Returns all roles available in the system.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  responses: {
    200: {
      description: "Roles retrieved successfully.",
      content: {
        "application/json": {
          schema: RolesResponse,
        },
      },
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
  },
});

// Get role by ID
registry.registerPath({
  method: "get",
  path: "/roles/{roleId}",
  tags: ["Role"],
  summary: "Get role by ID",
  description: "Returns a specific role by its ID.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: RoleIdParams,
  },
  responses: {
    200: {
      description: "Role retrieved successfully.",
      content: {
        "application/json": {
          schema: RoleResponse,
        },
      },
    },
    400: {
      description: "Invalid role ID.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
    404: {
      description: "Role not found.",
    },
  },
});

// Update role
registry.registerPath({
  method: "patch",
  path: "/roles/{roleId}",
  tags: ["Role"],
  summary: "Update a role",
  description: "Updates the name or description of an existing role.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: RoleIdParams,
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateRoleRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Role updated successfully.",
      content: {
        "application/json": {
          schema: RoleResponse,
        },
      },
    },
    400: {
      description: "Validation error or invalid role operation.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
    404: {
      description: "Role not found.",
    },
  },
});

// Delete role
registry.registerPath({
  method: "delete",
  path: "/roles/{roleId}",
  tags: ["Role"],
  summary: "Delete a role",
  description:
    "Deletes a role and invalidates cached permissions for users assigned to the role.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: RoleIdParams,
  },
  responses: {
    200: {
      description: "Role deleted successfully.",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: "Role deleted successfully",
            }),
          }),
        },
      },
    },
    400: {
      description: "Invalid role operation.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
    404: {
      description: "Role not found.",
    },
  },
});