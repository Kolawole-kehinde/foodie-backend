import { z } from "../zod-openapi.js";
import { registerSchema } from "../../modules/identity/validators/register.validator.js";
import { registry } from "../registry.js";


const RegisterRequest = registry.register(
  "RegisterRequest",
  registerSchema,
);

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

  description:
    "Creates a pending registration and sends a verification email.",

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
      description:
        "Email already exists or registration is already pending",
    },

    429: {
      description:
        "Too many registration attempts. Please try again later.",
    },
  },
});