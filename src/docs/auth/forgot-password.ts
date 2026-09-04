import { forgotPasswordResponseSchema } from "../../modules/identity/dto/forgot-password-dto.js";
import { forgotPasswordSchema } from "../../modules/identity/validators/forgot-password.validator.js";
import { registry } from "../registry.js";


const ForgotPasswordRequest = registry.register(
  "ForgotPasswordRequest",
  forgotPasswordSchema,
);

const ForgotPasswordResponse = registry.register(
  "ForgotPasswordResponse",
  forgotPasswordResponseSchema,
);

registry.registerPath({
  method: "post",
  path: "/auth/forgot-password",

  tags: ["Auth"],

  summary: "Request a password reset",

  description:
    "Requests a password reset link for a user account. The response is intentionally generic to prevent email enumeration. If the email belongs to an account, a password reset email is sent.",

  request: {
    body: {
      required: true,

      content: {
        "application/json": {
          schema: ForgotPasswordRequest,
        },
      },
    },
  },

  responses: {
    200: {
      description: "Password reset request processed",

      content: {
        "application/json": {
          schema: ForgotPasswordResponse,
        },
      },
    },

    400: {
      description: "Invalid email address",
    },

    429: {
      description:
        "Too many password reset requests. Please try again later.",
    },
  },
});