import {
  createMediaUploadSchema,
  confirmMediaUploadSchema,
} from "../../modules/media/schemas/media-upload.schema.js";

import { registry } from "../registry.js";
import { z } from "../zod-openapi.js";

const CreateMediaUploadRequest = registry.register(
  "CreateMediaUploadRequest",
  createMediaUploadSchema,
);

const CreateMediaUploadResponse = registry.register(
  "CreateMediaUploadResponse",
  z.object({
    uploadId: z.string().openapi({
      example: "cmt7ircy60006vc5cms59z9ck",
    }),

    objectKey: z.string().openapi({
      example:
        "avatars/cmt7ircy60006vc5cms59z9ck/550e8400-e29b-41d4-a716-446655440000.jpeg",
    }),

    url: z.string().url().openapi({
      example: "https://foodie-backend-storage.s3.amazonaws.com/",
      description:
        "Presigned S3 URL used to upload the file.",
    }),

    fields: z.record(z.string(), z.string()).openapi({
      description:
        "Form fields required when uploading the file directly to S3.",
    }),

    maxFileSize: z.number().openapi({
      example: 5242880,
      description:
        "Maximum allowed file size in bytes.",
    }),

    contentType: z.string().openapi({
      example: "image/jpeg",
    }),
  }),
);

const ConfirmMediaUploadRequest = registry.register(
  "ConfirmMediaUploadRequest",
  confirmMediaUploadSchema,
);

const ConfirmMediaUploadResponse = registry.register(
  "ConfirmMediaUploadResponse",
  z.object({
    id: z.string().openapi({
      example: "cmt7ircy60006vc5cms59z9ck",
    }),

    objectKey: z.string().openapi({
      example:
        "avatars/cmt7ircy60006vc5cms59z9ck/550e8400-e29b-41d4-a716-446655440000.jpeg",
    }),

    type: z.string().openapi({
      example: "AVATAR",
    }),

    status: z.literal("READY").openapi({
      example: "READY",
    }),

    fileSize: z.number().openapi({
      example: 245760,
      description: "Uploaded file size in bytes.",
    }),
  }),
);

registry.registerPath({
  method: "post",
  path: "/api/v1/media/uploads",

  tags: ["Media"],

  summary: "Create media upload",

  description:
    "Creates a pending media upload and returns a presigned S3 POST that allows the client to upload the file directly to object storage.",

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
          schema: CreateMediaUploadRequest,
        },
      },
    },
  },

  responses: {
    201: {
      description:
        "Presigned upload successfully created.",

      content: {
        "application/json": {
          schema: CreateMediaUploadResponse,
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

registry.registerPath({
  method: "post",
  path: "/media/uploads/{uploadId}/confirm",
  tags: ["Media"],
  summary: "Confirm media upload",
  description:
    "Verifies that the file exists in object storage, validates its metadata, and marks the pending upload as READY.",
  security: [
    {
      bearerAuth: [],
    },
  ],
  request: {
    params: ConfirmMediaUploadRequest,
  },
  responses: {
    200: {
      description: "Media upload confirmed successfully.",
      content: {
        "application/json": {
          schema: ConfirmMediaUploadResponse,
        },
      },
    },
    400: {
      description: "Invalid or incomplete uploaded file.",
    },
    401: {
      description: "Authentication required.",
    },
    404: {
      description: "Media upload not found.",
    },
  },
});