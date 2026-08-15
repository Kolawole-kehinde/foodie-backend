import { z } from "zod";
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";

import { registerSchema } from "../modules/identity/validators/register.validator.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const RegisterResponse = registry.register(
  "RegisterResponse",
  z.object({
    message: z.string(),
  })
);

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
      description:
        "Email already exists or registration is already pending",
    },
  },
});

const generator = new OpenApiGeneratorV3(
  registry.definitions
);

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
      description:
        "Authentication and identity endpoints",
    },
  ],
});