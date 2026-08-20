import { z } from "zod";

import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

import { registerSchema } from "../modules/identity/validators/register.validator.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

/**
 * Register Response
 */
const RegisterResponse = registry.register(
  "RegisterResponse",
  z.object({
    message: z.string().openapi({
      example:
        "Registration successful. Please verify your email.",
    }),
  })
);

/**
 * POST /auth/register
 */
registry.registerPath({
  method: "post",

  path: "/auth/register",

  tags: ["Auth"],

  summary: "Register a new user",

  description:
    "Creates a pending registration and sends a verification email.",

  request: {
    body: {
      required: true,

      content: {
        "application/json": {
          schema: registerSchema,
        },
      },
    },
  },

  responses: {
    /**
     * 201 - Registration successful
     */
    201: {
      description: "Registration successful",

      content: {
        "application/json": {
          schema: RegisterResponse,
        },
      },
    },

    /**
     * 400 - Validation error
     */
    400: {
      description: "Validation error",
    },

    /**
     * 409 - Conflict
     */
    409: {
      description:
        "Email already exists or registration is already pending",
    },

    /**
     * 429 - Rate limit exceeded
     */
    429: {
      description:
        "Too many registration attempts. Please try again later.",

      headers: {
        "X-RateLimit-Limit": {
          description:
            "Maximum number of requests allowed in the current rate-limit window.",

          schema: {
            type: "integer",
            example: 5,
          },
        },

        "X-RateLimit-Remaining": {
          description:
            "Number of requests remaining in the current rate-limit window.",

          schema: {
            type: "integer",
            example: 0,
          },
        },

        "X-RateLimit-Reset": {
          description:
            "Unix timestamp indicating when the rate-limit window resets.",

          schema: {
            type: "integer",
            example: 1755648000,
          },
        },

        "Retry-After": {
          description:
            "Number of seconds the client should wait before retrying.",

          schema: {
            type: "integer",
            example: 3600,
          },
        },
      },

      content: {
        "application/json": {
          schema: z.object({
            message: z.string().openapi({
              example:
                "Too many registration attempts. Please try again later.",
            }),
          }),
        },
      },
    },
  },
});

/**
 * Generate OpenAPI document
 */
const generator = new OpenApiGeneratorV3(
  registry.definitions
);

export const swaggerSpec = generator.generateDocument({
  openapi: "3.0.0",

  info: {
    title: "E-Commerce API",

    version: "1.0.0",

    description:
      "E-Commerce backend API",
  },

  servers: [
    {
      url: "http://localhost:4000/api/v1",
    },
  ],

  tags: [
    {
      name: "Auth",

      description:
        "Authentication and identity endpoints",
    },
  ],
});