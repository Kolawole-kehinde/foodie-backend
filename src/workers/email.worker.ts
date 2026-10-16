
import { Worker, type Job } from "bullmq";

import { logger } from "../config/logger.js";
import { redis } from "../database/redis/client.js";
import { createEmailService } from "../infrastructure/email/email.service.js";
import {
  EMAIL_QUEUE_NAME,
  emailDlq,
  type EmailJob,
} from "../queues/email/email.queue.js";

const MAX_ERROR_MESSAGE_LENGTH = 1_000;

const getSafeErrorDetails = (error: Error) => ({
  errorName: error.name,
  errorMessage: error.message.slice(0, MAX_ERROR_MESSAGE_LENGTH),
});

const processEmailJob = async (
  job: Job<EmailJob>,
): Promise<void> => {
  switch (job.data.type) {
    case "VERIFICATION_EMAIL":
      await createEmailService().sendVerificationEmail(
        job.data.email,
        job.data.otp,
      );
      return;

    case "PASSWORD_RESET_EMAIL":
      await createEmailService().sendForgotPasswordEmail(
        job.data.email,
        job.data.resetUrl,
      );
      return;

    default: {
      const unsupportedJob: never = job.data;
      throw new Error(
        `Unsupported email job: ${JSON.stringify(unsupportedJob)}`,
      );
    }
  }
};

const moveToDeadLetterQueue = async (
  job: Job<EmailJob>,
  error: Error,
): Promise<void> => {
  const attempts = job.opts.attempts ?? 1;

  if (job.attemptsMade < attempts) {
    logger.warn(
      {
        jobId: job.id,
        type: job.data.type,
        attemptsMade: job.attemptsMade,
        attempts,
        ...getSafeErrorDetails(error),
      },
      "Email job failed and will be retried",
    );

    return;
  }

  try {
    await emailDlq.add(
      "dead-letter-email",
      {
        originalJobId: job.id ?? "unknown",
        originalJobName: job.name,
        payload: job.data,
        attemptsMade: job.attemptsMade,
        failedReason: error.message.slice(
          0,
          MAX_ERROR_MESSAGE_LENGTH,
        ),
        failedAt: new Date().toISOString(),
      },
      {
        jobId: `email-${job.id}`,
      },
    );

    logger.error(
      {
        jobId: job.id,
        type: job.data.type,
        attemptsMade: job.attemptsMade,
        ...getSafeErrorDetails(error),
      },
      "Email job moved to dead-letter queue",
    );
  } catch (dlqError) {
    logger.error(
      {
        jobId: job.id,
        type: job.data.type,
        ...getSafeErrorDetails(error),
        dlqError:
          dlqError instanceof Error
            ? getSafeErrorDetails(dlqError)
            : { errorMessage: "Unknown dead-letter queue error" },
      },
      "Failed to move email job to dead-letter queue",
    );
  }
};

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
            job.data.otp,
          );
          break;

        case "PASSWORD_RESET_EMAIL":
          await emailService.sendForgotPasswordEmail(
            job.data.email,
            job.data.resetUrl,
          );
          break;

        default: {
          const unsupportedJob: never = job.data;
          throw new Error(
            `Unsupported email job: ${JSON.stringify(unsupportedJob)}`,
          );
        }
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
      { jobId: job.id },
      "Email job completed",
    );
  });

  worker.on("failed", (job, error) => {
    if (!job) {
      logger.error(
        getSafeErrorDetails(error),
        "Email worker failed without job information",
      );
      return;
    }

    void moveToDeadLetterQueue(job, error);
  });

  worker.on("error", (error) => {
    logger.error(
      getSafeErrorDetails(error),
      "Email worker error",
    );
  });

  return worker;
};

export const emailWorker = createEmailWorker();

logger.info("Email worker started");
