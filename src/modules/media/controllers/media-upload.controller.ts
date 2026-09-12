import type { Request, Response } from "express";
import type { MediaType } from "@prisma/client";

import type { MediaUploadService } from "../services/media-upload.service.js";

type CreateMediaUploadControllerDependencies = {
  mediaUploadService: MediaUploadService;
};

export const createMediaUploadController = ({
  mediaUploadService,
}: CreateMediaUploadControllerDependencies) => {
  const createUpload = async (req: Request, res: Response) => {
    const userId = req.user.id;

    const { type, contentType } = req.body as {
      type: MediaType;
      contentType: string;
    };

    const result = await mediaUploadService.createUpload({
      userId,
      type,
      contentType,
    });

    return res.status(201).json({
      success: true,
      data: result,
    });
  };




 const confirmUpload = async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { uploadId } = req.params;

  if (typeof uploadId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Invalid upload ID",
    });
  }

  const result = await mediaUploadService.confirmUpload(
    uploadId,
    userId,
  );

  return res.status(200).json({
    success: true,
    data: result,
  });
};

  return {
    createUpload,
    confirmUpload,
  };
};

export type MediaUploadController = ReturnType< typeof createMediaUploadController>;
