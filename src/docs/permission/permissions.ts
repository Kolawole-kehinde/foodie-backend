

import { permissionIdSchema } from "../../modules/identity/validators/permission.validation.js";
import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

const PermissionResponse = registry.register(
  "PermissionResponse",
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
    createdAt: z.string().datetime().openapi({
      example: "2026-09-16T10:00:00.000Z",
    }),
    updatedAt: z.string().datetime().openapi({
      example: "2026-09-16T10:00:00.000Z",
    }),
  }),
);

const PermissionsResponse = registry.register(
  "PermissionsResponse",
  z.array(PermissionResponse),
);

const PermissionIdParams = registry.register(
  "PermissionIdParams",
  permissionIdSchema,
);

// Get all permissions
registry.registerPath({
  method: "get",
  path: "/permissions",
  tags: ["Permission"],
  summary: "Get all permissions",
  description:
    "Returns the complete permission catalog available in the system.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  responses: {
    200: {
      description: "Permissions retrieved successfully.",
      content: {
        "application/json": {
          schema: PermissionsResponse,
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

// Get permission by ID
registry.registerPath({
  method: "get",
  path: "/permissions/{permissionId}",
  tags: ["Permission"],
  summary: "Get permission by ID",
  description: "Returns a specific permission by its ID.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: PermissionIdParams,
  },
  responses: {
    200: {
      description: "Permission retrieved successfully.",
      content: {
        "application/json": {
          schema: PermissionResponse,
        },
      },
    },
    400: {
      description: "Invalid permission ID.",
    },
    401: {
      description: "Authentication required.",
    },
    403: {
      description: "Insufficient permissions.",
    },
    404: {
      description: "Permission not found.",
    },
  },
});