import type { RequestHandler } from "express";

import { BadRequestError } from "../../shared/errors/BadRequestError.js";
import { asyncHandler } from "../../shared/utils/async-handler.js";
import type { EmailDlqService } from "../services/email-dlq.service.js";

type CreateEmailDlqControllerDependencies = {
  emailDlqService: EmailDlqService;
};

export type EmailDlqController = {
  replayJob: RequestHandler;
};

export const createEmailDlqController = ({emailDlqService,}: CreateEmailDlqControllerDependencies): EmailDlqController => {
    
  const replayJob = asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    if (typeof jobId !== "string" || !jobId) {
      throw new BadRequestError("DLQ job ID is required");
    }

    const result = await emailDlqService.replayJob(jobId);

    return res.status(200).json(result);
  });

  return {
    replayJob,
  };
};