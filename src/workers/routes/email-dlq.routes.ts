import { Router } from "express";
import { RoleName } from "@prisma/client";
import type { EmailDlqController } from "../controllers/email-dlq.controller.js";
import type { RequestHandler } from "express";

type CreateEmailDlqRoutesDependencies = {
  emailDlqController: EmailDlqController;
  authenticate: RequestHandler;
  authorize: (requiredRole: RoleName) => RequestHandler;
};

export const createEmailDlqRoutes = ({
  emailDlqController,
  authenticate,
  authorize,
}: CreateEmailDlqRoutesDependencies) => {
  const router = Router();

  router.post(
    "/:jobId/replay",
    authenticate,
    authorize(RoleName.ADMIN),
    emailDlqController.replayJob,
  );

  return router;
};