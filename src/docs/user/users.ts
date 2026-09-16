import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

const RoleSummary = registry.register(
  "UserRoleSummary",
  z.object({
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
);

const UserResponse = registry.register(
  "UserResponse",
  z.object({
    id: z.string().openapi({
      example: "cmt7ircy60006vc5cms59z9ck",
    }),
    email: z.string().email().openapi({
      example: "john@example.com",
    }),
    status: z.string().openapi({
      example: "ACTIVE",
    }),
    emailVerifiedAt: z.string().datetime().nullable().openapi({
      example: "2026-09-16T10:30:00.000Z",
    }),
    lastLoginAt: z.string().datetime().nullable().openapi({
      example: "2026-09-16T12:00:00.000Z",
    }),
    createdAt: z.string().datetime().openapi({
      example: "2026-09-15T10:00:00.000Z",
    }),
    updatedAt: z.string().datetime().openapi({
      example: "2026-09-16T12:00:00.000Z",
    }),
    roles: z.array(RoleSummary),
  }),
);

const UsersResponse = registry.register(
  "UsersResponse",
  z.array(UserResponse),
);

const UserIdParams = registry.register(
  "UserIdParams",
  z.object({
    userId: z.string().openapi({
      example: "cmt7ircy60006vc5cms59z9ck",
    }),
  }),
);

// Get all users
registry.registerPath({
  method: "get",
  path: "/users",
  tags: ["User"],
  summary: "Get all users",
  description: "Returns all users in the system.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  responses: {
    200: {
      description: "Users retrieved successfully.",
      content: {
        "application/json": {
          schema: UsersResponse,
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

// Get current user
registry.registerPath({
  method: "get",
  path: "/users/me",
  tags: ["User"],
  summary: "Get current user",
  description: "Returns the account information of the authenticated user.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  responses: {
    200: {
      description: "Current user retrieved successfully.",
      content: {
        "application/json": {
          schema: UserResponse,
        },
      },
    },
    401: {
      description: "Authentication required.",
    },
  },
});

// Get user by ID
registry.registerPath({
  method: "get",
  path: "/users/{userId}",
  tags: ["User"],
  summary: "Get user by ID",
  description: "Returns a specific user by their ID.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: UserIdParams,
  },
  responses: {
    200: {
      description: "User retrieved successfully.",
      content: {
        "application/json": {
          schema: UserResponse,
        },
      },
    },
    400: {
      description: "Invalid user ID.",
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