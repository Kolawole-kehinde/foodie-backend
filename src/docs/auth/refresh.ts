import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";


const RefreshResponse = registry.register(
  "RefreshResponse",
  z.object({
    accessToken: z.string().openapi({
      example: "eyJhbGciOiJIUzI1NiIs...",
    }),

    expiresIn: z.number().openapi({
      example: 900,
      description: "Access token lifetime in seconds.",
    }),

    user: z.object({
      id: z.string().openapi({
        example: "cmt7ircy60006vc5cms59z9ck",
      }),

      email: z.string().email().openapi({
        example: "user@example.com",
      }),

      roles: z.array(z.string()).openapi({
        example: ["USER"],
      }),
    }),
  }),
);

registry.registerPath({
  method: "post",
  path: "/auth/refresh",

  tags: ["Auth"],

  summary: "Refresh access token",

  description:
    "Uses the refresh token stored in an HttpOnly cookie to issue a new access token. The refresh token is rotated after successful use. Reuse of a previously rotated refresh token causes the associated session to be revoked.",

  responses: {
    200: {
      description: "Access token refreshed successfully",

      content: {
        "application/json": {
          schema: RefreshResponse,
        },
      },
    },

    401: {
      description:
        "Invalid, expired, revoked, or reused refresh token",
    },

    403: {
      description: "Account suspended",
    },
  },
});