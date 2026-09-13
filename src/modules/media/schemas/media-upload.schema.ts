import { z } from "../../../docs/zod-openapi.js";

export const createMediaUploadSchema = z.object({
  type: z.enum(["AVATAR", "PRODUCT_IMAGE"]),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const confirmMediaUploadSchema = z.object({
  uploadId: z.string().min(1),
});

export type CreateMediaUploadInput = z.infer<typeof createMediaUploadSchema>;

export type ConfirmMediaUploadInput = z.infer<typeof confirmMediaUploadSchema>;
