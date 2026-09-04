import { z } from "../zod-openapi.js";
import { registry } from "../registry.js";
import { verifyEmailSchema } from "../../modules/identity/validators/verify-email.validator.js";

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
      description:
        "Too many verification attempts. Please try again later.",
    },
  },
});