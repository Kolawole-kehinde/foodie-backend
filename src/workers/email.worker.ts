import { Worker } from "bullmq";
import { createEmailService } from "../infrastructure/email/email.service.js";
import {EMAIL_QUEUE_NAME,emailDlq,type EmailJob,} from "../queues/email/email.queue.js";
import { redis } from "../database/redis/client.js";
import { logger } from "../config/logger.js";

export const createEmailWorker = () => {
  const emailService = createEmailService();

  const worker = new Worker<EmailJob>(
    EMAIL_QUEUE_NAME,
    async (job) => {
      logger.info(
        {
          jobId: job.id,
          type: job.data.type,
        },
        "Processing email job",
      );

      switch (job.data.type) {
        case "VERIFICATION_EMAIL":
          await emailService.sendVerificationEmail(
            job.data.email,
            job.data.verificationToken,
          );
          break;

        case "PASSWORD_RESET_EMAIL":
          await emailService.sendForgotPasswordEmail(
            job.data.email,
            job.data.resetUrl,
          );
          break;

       default:
         throw new Error("Unsupported email job type");
      }
    },
    {
      connection: redis,
      concurrency: 5,
    },
  );



  worker.on("ready", () => {
    logger.info("Email worker is ready");
  });

  worker.on("completed", (job) => {
    logger.info(
      {
        jobId: job.id,
      },
      "Email job completed",
    );
  });

worker.on("failed", async (job, error) => {
  if (!job || !job.id) {
    logger.error(
      { err: error },
      "Email worker failed without job information",
    );
    return;
  }

  const attempts = job.opts.attempts ?? 1;
  const exhausted = job.attemptsMade >= attempts;

  if (exhausted) {
    await emailDlq.add("dead-letter-email", {
      originalJobId: job.id,
      originalJobName: job.name,
      payload: job.data,
      attemptsMade: job.attemptsMade,
      failedReason: error.message,
      failedAt: new Date().toISOString(),
    });

    logger.error(
      {
        jobId: job.id,
        type: job.data.type,
        attemptsMade: job.attemptsMade,
        attempts,
        err: error,
      },
      "Email job moved to DLQ after exhausting all retries",
    );

    return;
  }

  logger.warn(
    {
      jobId: job.id,
      type: job.data.type,
      attemptsMade: job.attemptsMade,
      attempts,
      err: error,
    },
    "Email job failed, retrying",
  );
});

  worker.on("error", (error) => {
    logger.error(
      {
        err: error,
      },
      "Email worker error",
    );
  });

  return worker;
};
    // await createEmailWorker();
const emailWorker = createEmailWorker();

logger.info("Email worker started");
