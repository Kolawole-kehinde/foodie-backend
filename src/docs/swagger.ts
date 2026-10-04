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

// User documentation
import "./user/profile.js";
import "./user/users.js";
import "./user/user-roles.js";

// Catalog documentation
import "./catalog/categories.js";
import "./catalog/products.js";

// Inventory Documentation
import "./inventory/inventory.js";

// Cart Documentation
import "./cart/cart.js";

// Order Documentation
import "./orders/orders.js";

// Payment Documentation
import "./payments/payment.js";

// Role documentation
import "./role/roles.js";
import "./role/role-permissions.js";

// Permission documentation
import "./permission/permissions.js";

// Media documentation
import "./media/uploads.js";

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
      url: "http://localhost:4000",
    },
  ],

  tags: [
    {
      name: "Auth",
      description: "Authentication and identity endpoints",
    },
    {
      name: "User",
      description: "Authenticated user self-service endpoints",
    },

    {
      name: "Catalog - Categories",
      description: "Product category management endpoints",
    },
    {
      name: "Catalog - Products",
      description: "Product catalog and management endpoints",
    },

    {
      name: "Cart",
      description: "Shopping cart management endpoints",
    },
    {
      name: "Inventory",
      description: "Inventory and stock management endpoints",
    },

    {
      name: "Orders",
      description: "Order creation, retrieval, and cancellation endpoints",
    },

    {
      name: "Payments",
      description:
        "Payment initialization, verification, refunds, and webhook endpoints",
    },
    {
      name: "Profile",
      description: "Authenticated user profile endpoints",
    },

    {
      name: "Catalog - Categories",
      description: "Product category management endpoints",
    },
    {
      name: "Catalog - Products",
      description: "Product catalog and management endpoints",
    },
    {
      name: "Admin - Users",
      description:
        "Administrative user management and role assignment endpoints",
    },
    {
      name: "Admin - Roles",
      description:
        "Administrative role management and permission assignment endpoints",
    },
    {
      name: "Admin - Permissions",
      description: "Administrative permission catalog endpoints",
    },
    {
      name: "Media",
      description: "Media upload and management endpoints",
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
