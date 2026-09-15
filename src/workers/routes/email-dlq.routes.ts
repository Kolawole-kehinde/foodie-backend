import { Router } from "express";
import type { RequestHandler } from "express";

import type { EmailDlqController } from "../controllers/email-dlq.controller.js";

type CreateEmailDlqRoutesDependencies = {
  emailDlqController: EmailDlqController;
  authenticate: RequestHandler;
  authorizePermission: ( requiredPermission: string,) => RequestHandler;
};

export const createEmailDlqRoutes = ({ emailDlqController, authenticate,authorizePermission,}: CreateEmailDlqRoutesDependencies) => {
  const router = Router();

  router.post(
    "/:jobId/replay",
    authenticate,
    authorizePermission("email-dlq.replay"),
    emailDlqController.replayJob,
  );

  return router;
};