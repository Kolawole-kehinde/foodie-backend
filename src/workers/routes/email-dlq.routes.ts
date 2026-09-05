import { Router, type RequestHandler } from "express";

import type { EmailDlqController } from "../controllers/email-dlq.controller.js";

type CreateEmailDlqRoutesDependencies = {
  emailDlqController: EmailDlqController;
  authenticate: RequestHandler;
  authorize: ReturnType<typeof authorize>;
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
    authorize("ADMIN"),
    emailDlqController.replayJob,
  );

  return router;
};