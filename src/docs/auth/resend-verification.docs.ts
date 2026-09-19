import { z } from "../zod-openapi.js";
import { registry } from "../registry.js";
import { resendVerificationSchema } from "../../modules/identity/validators/resend-verification.validator.js";

const ResendVerificationRequest = registry.register(
  "ResendVerificationRequest",
  resendVerificationSchema,
);

const ResendVerificationResponse = registry.register(
  "ResendVerificationResponse",
  z.object({
    message: z.string().openapi({
      example:
        "If the email is associated with a pending registration, a verification code has been sent.",
    }),
  }),
);

registry.registerPath({
  method: "post",
  path: "/auth/resend-verification",
  tags: ["Auth"],
  summary: "Resend email verification code",
  description:
    "Resends a one-time verification code for a pending registration. The previous verification code is replaced, and the endpoint does not reveal whether an email has a pending registration.",
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: ResendVerificationRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Verification code resend request processed",
      content: {
        "application/json": {
          schema: ResendVerificationResponse,
        },
      },
    },
    400: {
      description: "Invalid email address",
    },
    409: {
      description:
        "A verification code was recently requested. Please wait before requesting another.",
    },
    429: {
      description: "Too many resend verification requests",
    },
  },
});