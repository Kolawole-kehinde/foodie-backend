import {
  assignRolePermissionSchema,
  roleIdSchema,
  rolePermissionParamsSchema,
} from "../../modules/identity/validators/role-permission.validation.js";

import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

const AssignRolePermissionRequest = registry.register(
  "AssignRolePermissionRequest",
  assignRolePermissionSchema,
);

const PermissionSummary = registry.register(
  "RolePermissionSummary",
  z.object({
    id: z.string().openapi({
      example: "cmt7ipermission0001",
    }),
    name: z.string().openapi({
      example: "users.read",
    }),
    resource: z.string().openapi({
      example: "users",
    }),
    action: z.string().openapi({
      example: "read",
    }),
    description: z.string().nullable().openapi({
      example: "Read user accounts",
    }),
  }),
);

const RolePermissionResponse = registry.register(
  "RolePermissionResponse",
  z.object({
    roleId: z.string().openapi({
      example: "cmt7imm3w0003vcyo999bhdm1",
    }),
    permissionId: z.string().openapi({
      example: "cmt7ipermission0001",
    }),
    permission: PermissionSummary,
  }),
);

const RolePermissionsResponse = registry.register(
  "RolePermissionsResponse",
  z.array(RolePermissionResponse),
);

const RoleIdParams = registry.register(
  "RolePermissionRoleIdParams",
  roleIdSchema,
);

const RolePermissionParams = registry.register(
  "RolePermissionParams",
  rolePermissionParamsSchema,
);

// Assign permission to role
registry.registerPath({
  method: "post",
  path: "/roles/{roleId}/permissions",
  tags: ["Role"],
  summary: "Assign permission to role",
  description:
    "Assigns an existing permission to a role and invalidates cached permissions for all users assigned to that role.",
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
          schema: AssignRolePermissionRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Permission assigned successfully.",
      content: {
        "application/json": {
          schema: RolePermissionResponse,
        },
      },
    },
    400: {
      description:
        "Invalid request or permission is already assigned to the role.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
    404: {
      description: "Role or permission not found.",
    },
  },
});

// Get role permissions
registry.registerPath({
  method: "get",
  path: "/roles/{roleId}/permissions",
  tags: ["Role"],
  summary: "Get role permissions",
  description: "Returns all permissions assigned to a specific role.",
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
      description: "Role permissions retrieved successfully.",
      content: {
        "application/json": {
          schema: RolePermissionsResponse,
        },
      },
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

// Remove permission from role
registry.registerPath({
  method: "delete",
  path: "/roles/{roleId}/permissions/{permissionId}",
  tags: ["Role"],
  summary: "Remove permission from role",
  description:
    "Removes a permission from a role and invalidates cached permissions for all users assigned to that role.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: RolePermissionParams,
  },
  responses: {
    200: {
      description: "Permission removed successfully.",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: "Permission removed from role successfully",
            }),
          }),
        },
      },
    },
    400: {
      description: "Permission is not assigned to the role.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
    404: {
      description: "Role or permission not found.",
    },
  },
});
