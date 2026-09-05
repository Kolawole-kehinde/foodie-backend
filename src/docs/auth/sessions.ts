import { z } from "../zod-openapi.js";
import { registry } from "../registry.js";

// Get Active Sessions
const SessionResponse = registry.register(
  "SessionResponse",
  z.object({
    id: z.string().openapi({
      example: "cmtjrsanf0002vcl8hrvlwfol",
    }),

    deviceName: z.string().nullable().openapi({
      example: "Chrome on Windows",
    }),

    userAgent: z.string().nullable().openapi({
      example: "PostmanRuntime/2.4.3",
    }),

    ipAddress: z.string().nullable().openapi({
      example: "192.168.1.10",
    }),

    country: z.string().nullable().openapi({
      example: "Nigeria",
    }),

    city: z.string().nullable().openapi({
      example: "Ibadan",
    }),

    lastActivityAt: z.string().datetime().nullable().openapi({
      example: "2026-09-02T07:23:44.314Z",
    }),

    expiresAt: z.string().datetime().openapi({
      example: "2026-09-09T07:23:44.314Z",
    }),

    createdAt: z.string().datetime().openapi({
      example: "2026-09-02T07:23:45.004Z",
    }),

    isCurrent: z.boolean().openapi({
      example: true,
      description:
        "Indicates whether this is the session making the current request.",
    }),
  }),
);

const GetSessionsResponse = registry.register(
  "GetSessionsResponse",
  z.object({
    sessions: z.array(SessionResponse),
  }),
);

registry.registerPath({
  method: "get",
  path: "/auth/sessions",

  tags: ["Auth"],

  summary: "Get active sessions",

  description:
    "Returns all active sessions belonging to the authenticated user. The current session is identified using the isCurrent field.",

  security: [
    {
      bearerAuth: [],
    },
  ],

  responses: {
    200: {
      description: "Active sessions retrieved successfully",

      content: {
        "application/json": {
          schema: GetSessionsResponse,
        },
      },
    },

    401: {
      description:
        "Authentication required or the current session is no longer active",
    },
  },
});

// Revoke Single Session

const RevokeSessionResponse = registry.register(
  "RevokeSessionResponse",
  z.object({
    message: z.string().openapi({
      example: "Session revoked successfully",
    }),
  }),
);

registry.registerPath({
  method: "delete",
  path: "/auth/sessions/{sessionId}",

  tags: ["Auth"],

  summary: "Revoke a single session",

  description:
    "Revokes a specific active session belonging to the authenticated user. Once revoked, access tokens associated with the session are no longer accepted by the authentication middleware.",

  security: [
    {
      bearerAuth: [],
    },
  ],

  request: {
    params: z.object({
      sessionId: z.string().openapi({
        example: "cmtjukdjx0002vcvgwooiz3xl",
        description: "The ID of the session to revoke.",
      }),
    }),
  },

  responses: {
    200: {
      description: "Session revoked successfully",

      content: {
        "application/json": {
          schema: RevokeSessionResponse,
        },
      },
    },

    400: {
      description: "Session ID is required or invalid",
    },

    401: {
      description:
        "Authentication required or the current session is no longer active",
    },

    404: {
      description:
        "Session not found or the session does not belong to the authenticated user",
    },
  },
});