import { z } from "./zod-openapi.js";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { registerSchema } from "../modules/identity/validators/register.validator.js";
import { verifyEmailSchema } from "../modules/identity/validators/verify-email.validator.js";
import { loginSchema } from "../modules/identity/validators/login.validator.js";

import type { OpenAPIObject } from "openapi3-ts/oas30";
import { refreshTokenCookieSchema } from "../modules/identity/validators/refresh-token-validator.js";

const registry = new OpenAPIRegistry();

/*
|--------------------------------------------------------------------------
| Register
|--------------------------------------------------------------------------
*/

const RegisterRequest = registry.register("RegisterRequest", registerSchema);

const RegisterResponse = registry.register(
  "RegisterResponse",
  z.object({
    message: z.string().openapi({
      example: "Registration successful. Please verify your email.",
    }),
  }),
);

registry.registerPath({
  method: "post",
  path: "/auth/register",

  tags: ["Auth"],

  summary: "Register a new user",

  description: "Creates a pending registration and sends a verification email.",

  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: RegisterRequest,
        },
      },
    },
  },

  responses: {
    201: {
      description: "Registration successful",

      content: {
        "application/json": {
          schema: RegisterResponse,
        },
      },
    },

    400: {
      description: "Validation error",
    },

    409: {
      description: "Email already exists or registration is already pending",
    },

    429: {
      description: "Too many registration attempts. Please try again later.",
    },
  },
});

/*
|--------------------------------------------------------------------------
| Verify Email
|--------------------------------------------------------------------------
*/

const VerifyEmailRequest = registry.register(
  "VerifyEmailRequest",
  verifyEmailSchema,
);

const VerifyEmailResponse = registry.register(
  "VerifyEmailResponse",
  z.object({
    message: z.string().openapi({
      example: "Email verified successfully.",
    }),
  }),
);

registry.registerPath({
  method: "post",

  path: "/auth/verify-email",

  tags: ["Auth"],

  summary: "Verify user email",

  description:
    "Verifies a user's email address using the verification token sent during registration.",

  request: {
    body: {
      required: true,

      content: {
        "application/json": {
          schema: VerifyEmailRequest,
        },
      },
    },
  },

  responses: {
    200: {
      description: "Email verified successfully",

      content: {
        "application/json": {
          schema: VerifyEmailResponse,
        },
      },
    },

    400: {
      description: "Validation error",
    },

    409: {
      description: "Invalid or expired verification token",
    },

    429: {
      description: "Too many verification attempts. Please try again later.",
    },
  },
});

/*
|--------------------------------------------------------------------------
| Login
|--------------------------------------------------------------------------
*/

const LoginRequest = registry.register("LoginRequest", loginSchema);

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
      description: "Invalid email or password, or account temporarily locked",
    },

    403: {
      description: "Account suspended",
    },

    429: {
      description: "Too many login attempts. Please try again later.",
    },
  },
});

/*
|--------------------------------------------------------------------------
| Refresh Token
|--------------------------------------------------------------------------
*/

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


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

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
      description:
        "Invalid or missing refresh token",
    },
  },
});
/*
|--------------------------------------------------------------------------
| Generate OpenAPI document
|--------------------------------------------------------------------------
*/

const generator = new OpenApiGeneratorV3(registry.definitions);

export const swaggerSpec = generator.generateDocument({
  openapi: "3.0.0",

  info: {
    title: "E-Commerce API",
    version: "1.0.0",
    description: "E-Commerce backend API",
  },

  servers: [
    {
      url: "http://localhost:4000/api/v1",
    },
  ],

  tags: [
    {
      name: "Auth",
      description: "Authentication and identity endpoints",
    },
  ],
});
