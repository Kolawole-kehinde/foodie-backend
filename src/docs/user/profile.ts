import { updateProfileSchema } from "../../modules/profile/schemas/profile.schema.js";

import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

const UpdateProfileRequest = registry.register(
  "UpdateProfileRequest",
  updateProfileSchema,
);

const ProfileResponse = registry.register(
  "ProfileResponse",
  z.object({
    success: z.boolean().openapi({
      example: true,
    }),
    data: z.object({
      id: z.string().openapi({
        example: "cmt7ircy60006vc5cms59z9ck",
      }),
      firstName: z.string().nullable().openapi({
        example: "John",
      }),
      lastName: z.string().nullable().openapi({
        example: "Doe",
      }),
      phone: z.string().nullable().openapi({
        example: "+2348012345678",
      }),
      bio: z.string().nullable().openapi({
        example: "Software developer",
      }),
      avatarUrl: z.string().url().nullable().openapi({
        example:
          "https://foodie-backend-storage.s3.amazonaws.com/avatars/...",
        description:
          "Temporary signed URL for accessing the user's avatar.",
      }),
    }),
  }),
);

registry.registerPath({
  method: "get",
  path: "/profile",
  tags: ["User"],
  summary: "Get user profile",
  description:
    "Returns the authenticated user's profile. If the profile does not exist, it is created automatically.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  responses: {
    200: {
      description: "Profile retrieved successfully.",
      content: {
        "application/json": {
          schema: ProfileResponse,
        },
      },
    },
    401: {
      description: "Authentication required.",
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/profile",
  tags: ["User"],
  summary: "Update user profile",
  description:
    "Updates the authenticated user's profile information.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    body: {
      required: true,
      content: {
        "application/json": {
          schema: UpdateProfileRequest,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Profile updated successfully.",
      content: {
        "application/json": {
          schema: ProfileResponse,
        },
      },
    },
    400: {
      description: "Validation error.",
    },
    401: {
      description: "Authentication required.",
    },
  },
});