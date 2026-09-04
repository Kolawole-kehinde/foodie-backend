import { z } from "../zod-openapi.js";
import { registry } from "../registry.js";

const LogoutAllDevicesResponse = registry.register(
  "LogoutAllDevicesResponse",
  z.object({
    message: z.string().openapi({
      example: "Logged out from all devices successfully",
    }),

    sessionsRevoked: z.number().openapi({
      example: 3,
      description: "Number of active sessions that were revoked.",
    }),

    refreshTokensRevoked: z.number().openapi({
      example: 3,
      description: "Number of active refresh tokens that were revoked.",
    }),
  }),
);

registry.registerPath({
  method: "post",
  path: "/auth/logout-all-devices",

  tags: ["Auth"],

  summary: "Log out from all devices",

  description:
    "Revokes all active sessions and refresh tokens belonging to the authenticated user. Any existing access tokens associated with those sessions become invalid immediately because the authentication middleware validates session status.",

  security: [
    {
      bearerAuth: [],
    },
  ],

  responses: {
    200: {
      description: "Successfully logged out from all devices",

      content: {
        "application/json": {
          schema: LogoutAllDevicesResponse,
        },
      },
    },

    401: {
      description:
        "Authentication required or the current session is no longer active",
    },
  },
});