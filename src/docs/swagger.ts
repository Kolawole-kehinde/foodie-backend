import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";

import { registry } from "./registry.js";

// Auth documentation
import "./auth/register.js";
import "./auth/verify-email.js";
import "./auth/login.js";
import "./auth/refresh.js";
import "./auth/logout.js";
import "./auth/logout-all-devices.js";
import "./auth/sessions.js";
import "./auth/forgot-password.js";
import "./auth/reset-password.js";

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

swaggerSpec.components = {
  ...swaggerSpec.components,

  securitySchemes: {
    bearerAuth: {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    },
  },
};