import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../../config/env.js";
import { s3Client } from "./client.js";


const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const createS3Service = () => {
  const createUploadForm = async (key: string, contentType: string) => {

    if (!ALLOWED_IMAGE_TYPES.includes(contentType as (typeof ALLOWED_IMAGE_TYPES)[number],)) {
      throw new Error("Unsupported image type");
    }

    const { url, fields } = await createPresignedPost(s3Client, {
      Bucket: env.aws.bucketName,
      Key: key,
      Conditions: [
        ["content-length-range", 1, MAX_FILE_SIZE],
        ["eq", "$Content-Type", contentType],
      ],
      Fields: {
        "Content-Type": contentType,
      },
      Expires: 300,
    });

    return {
      url,
      fields,
      maxFileSize: MAX_FILE_SIZE,
      contentType,
    };
  };

  const createDownloadUrl = async (key: string) => {
    const command = new GetObjectCommand({
      Bucket: env.aws.bucketName,
      Key: key,
    });

    return getSignedUrl(s3Client, command, {
      expiresIn: 300,
    });
  };

  const deleteObject = async (key: string) => {
    const command = new DeleteObjectCommand({
      Bucket: env.aws.bucketName,
      Key: key,
    });

    await s3Client.send(command);
  };

  const headObject = async (key: string) => {
  return s3Client.send(
    new HeadObjectCommand({
      Bucket: env.aws.bucketName,
      Key: key,
    }),
  );
};

  return {
    createUploadForm,
    createDownloadUrl,
    deleteObject,
    headObject
  };
};

export type S3Service = ReturnType<typeof createS3Service>;
