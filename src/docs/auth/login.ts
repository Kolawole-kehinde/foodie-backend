import { loginSchema } from "../../modules/identity/validators/login.validator.js";
import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";


const LoginRequest = registry.register(
  "LoginRequest",
  loginSchema,
);

const LoginResponse = registry.register(
  "LoginResponse",
  z.object({
    accessToken: z.string().openapi({
      example: "eyJhbGciOiJIUzI1NiIs...",
    }),

    refreshToken: z.string().openapi({
      example: "9b8f1c7e...",
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
  path: "/auth/login",

  tags: ["Auth"],

  summary: "Authenticate user",

  description:
    "Authenticates a user using email and password and creates an authenticated session.",

  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: LoginRequest,
        },
      },
    },
  },

  responses: {
    200: {
      description: "Login successful",

      content: {
        "application/json": {
          schema: LoginResponse,
        },
      },
    },

    400: {
      description: "Validation error",
    },

    401: {
      description:
        "Invalid email or password, or account temporarily locked",
    },

    403: {
      description: "Account suspended",
    },

    429: {
      description:
        "Too many login attempts. Please try again later.",
    },
  },
});