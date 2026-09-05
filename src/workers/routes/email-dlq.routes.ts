import { Router } from "express";

import type { EmailDlqController } from "../controllers/email-dlq.controller.js";

type CreateEmailDlqRoutesDependencies = {
  emailDlqController: EmailDlqController;
};

export const createEmailDlqRoutes = ({
  emailDlqController,
}: CreateEmailDlqRoutesDependencies) => {
  const router = Router();

  router.post(
    "/:jobId/replay",
    emailDlqController.replayJob,
  );

  return router;
};