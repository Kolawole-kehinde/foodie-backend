

import { assignUserRoleSchema, userRoleParamsSchema } from "../../modules/identity/validators/user-role.validation.js";
import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

const AssignUserRoleRequest = registry.register(
  "AssignUserRoleRequest",
  assignUserRoleSchema.pick({
    roleId: true,
  }),
);

const UserRoleResponse = registry.register(
  "UserRoleResponse",
  z.object({
    userId: z.string().openapi({
      example: "cmt7ircy60006vc5cms59z9ck",
    }),
    roleId: z.string().openapi({
      example: "cmt7imm3w0003vcyo999bhdm1",
    }),
    role: z.object({
      id: z.string().openapi({
        example: "cmt7imm3w0003vcyo999bhdm1",
      }),
      name: z.string().openapi({
        example: "ADMIN",
      }),
      description: z.string().nullable().openapi({
        example: "System administrator",
      }),
    }),
  }),
);

const UserRolesResponse = registry.register(
  "UserRolesResponse",
  z.array(UserRoleResponse),
);

const UserRoleParams = registry.register(
  "UserRoleParams",
  userRoleParamsSchema,
);

// Assign role to user
registry.registerPath({
  method: "post",
  path: "/api/v1/users/{userId}/roles",
  tags: ["Admin - Users"],
  summary: "Assign role to user",
  description:
    "Assigns an existing role to a user and invalidates the user's cached permissions.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: z.object({
      userId: z.string().openapi({
        example: "cmt7ircy60006vc5cms59z9ck",
      }),
    }),
    body: {
      required: true,
      content: {
        "application/json": {
          schema: AssignUserRoleRequest,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Role assigned successfully.",
      content: {
        "application/json": {
          schema: UserRoleResponse,
        },
      },
    },
    400: {
      description: "Invalid request or user already has this role.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
    404: {
      description: "User or role not found.",
    },
  },
});

// Get user's roles
registry.registerPath({
  method: "get",
  path: "/api/v1/users/{userId}/roles",
  tags: ["Admin - Users"],
  summary: "Get user roles",
  description: "Returns all roles assigned to a specific user.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: z.object({
      userId: z.string().openapi({
        example: "cmt7ircy60006vc5cms59z9ck",
      }),
    }),
  },
  responses: {
    200: {
      description: "User roles retrieved successfully.",
      content: {
        "application/json": {
          schema: UserRolesResponse,
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
      description: "User not found.",
    },
  },
});

// Remove role from user
registry.registerPath({
  method: "delete",
  path: "/api/v1/users/{userId}/roles/{roleId}",
   tags: ["Admin - Users"],
  summary: "Remove role from user",
  description:
    "Removes an assigned role from a user and invalidates the user's cached permissions.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: UserRoleParams,
  },
  responses: {
    200: {
      description: "Role removed successfully.",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example: "Role removed from user successfully",
            }),
          }),
        },
      },
    },
    400: {
      description: "Invalid request or role is not assigned to the user.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
    404: {
      description: "User or role not found.",
    },
  },
});