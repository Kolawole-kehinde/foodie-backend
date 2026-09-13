import { randomUUID } from "node:crypto";
import type { MediaType } from "@prisma/client";

import type { MediaUploadRepository } from "../repositories/media-upload.repository.js";
import type { ProfileRepository } from "../../profile/repositories/profile.repository.js";
import type { S3Service } from "../../../infrastructure/s3/s3.service.js";

type CreateMediaUploadServiceDependencies = {
  mediaUploadRepository: MediaUploadRepository;
  profileRepository: ProfileRepository;
  s3Service: S3Service;
};

type CreateUploadInput = {
  userId: string;
  type: MediaType;
  contentType: string;
};

export const createMediaUploadService = ({
  mediaUploadRepository,
  profileRepository,
  s3Service,
}: CreateMediaUploadServiceDependencies) => {
  const createUpload = async ({
    userId,
    type,
    contentType,
  }: CreateUploadInput) => {
    const extension = contentType.split("/")[1];

    const objectKey =
      type === "AVATAR"
        ? `avatars/${userId}/${randomUUID()}.${extension}`
        : `products/${randomUUID()}.${extension}`;

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    const mediaUpload = await mediaUploadRepository.create({
      uploadedById: userId,
      type,
      objectKey,
      contentType,
      expiresAt,
    });

    try {
      const uploadForm = await s3Service.createUploadForm(
        objectKey,
        contentType,
      );

      return {
        uploadId: mediaUpload.id,
        objectKey,
        ...uploadForm,
      };
    } catch (error) {
      await mediaUploadRepository.markFailed(mediaUpload.id, userId);

      throw error;
    }
  };

  const confirmUpload = async (uploadId: string, userId: string) => {
    const mediaUpload = await mediaUploadRepository.findById(uploadId, userId);

    if (!mediaUpload) {
      throw new Error("Media upload not found");
    }

    if (mediaUpload.status !== "PENDING") {
      throw new Error("Media upload is not pending");
    }

    const object = await s3Service.headObject(mediaUpload.objectKey);

    if (!object.ContentLength) {
      throw new Error("Uploaded file is empty");
    }

    if (object.ContentLength > 5 * 1024 * 1024) {
      throw new Error("Uploaded file is too large");
    }

    if (object.ContentType !== mediaUpload.contentType) {
      throw new Error("Uploaded file content type does not match");
    }

    const result = await mediaUploadRepository.markReady(
      uploadId,
      userId,
      object.ContentLength,
    );

    if (result.count !== 1) {
      throw new Error("Media upload could not be confirmed");
    }

    if (mediaUpload.type === "AVATAR") {
      await profileRepository.updateAvatarKey(userId, mediaUpload.objectKey);
    }

    return {
      id: mediaUpload.id,
      objectKey: mediaUpload.objectKey,
      type: mediaUpload.type,
      status: "READY" as const,
      fileSize: object.ContentLength,
    };
  };

  return {
    createUpload,
    confirmUpload,
  };
};

export type MediaUploadService = ReturnType<typeof createMediaUploadService>;
