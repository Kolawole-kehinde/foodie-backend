import { Router, type RequestHandler } from "express";
import type { MediaUploadController } from "../controllers/media-upload.controller.js";
import {createMediaUploadSchema,confirmMediaUploadSchema,} from "../schemas/media-upload.schema.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";



type CreateMediaUploadRoutesDependencies = {
  mediaUploadController: MediaUploadController;
  authenticate: RequestHandler;
};

export const createMediaUploadRoutes = ({ mediaUploadController, authenticate,}: CreateMediaUploadRoutesDependencies) => {

  const router = Router();

 router.post(
    "/uploads",
    authenticate,
    validate({
      body: createMediaUploadSchema,
    }),
    mediaUploadController.createUpload,
  );

  router.post(
    "/uploads/:uploadId/confirm",
    authenticate,
    validate({
      params: confirmMediaUploadSchema,
    }),
    mediaUploadController.confirmUpload,
  );

  return router;
};
