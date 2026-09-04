import { z } from "../zod-openapi.js";
import { registry } from "../registry.js";

const LogoutResponse = registry.register(
  "LogoutResponse",
  z.object({
    message: z.string().openapi({
      example: "Logged out successfully.",
    }),
  }),
);

registry.registerPath({
  method: "post",
  path: "/auth/logout",

  tags: ["Auth"],

  summary: "Log out current session",

  description:
    "Logs out the current user by revoking the refresh token and associated session, then clearing the refresh token cookie.",

  security: [
    {
      bearerAuth: [],
    },
  ],

  responses: {
    200: {
      description: "Logout successful",

      content: {
        "application/json": {
          schema: LogoutResponse,
        },
      },
    },

    401: {
      description: "Authentication required or session is no longer active",
    },
  },
});