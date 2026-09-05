import { Worker } from "bullmq";
import { EMAIL_DLQ_NAME, type EmailDlqJob,} from "../queues/email/email.queue.js";
import { redis } from "../database/redis/client.js";
import { logger } from "../config/logger.js";

export const createEmailDlqWorker = () => {
  const worker = new Worker<EmailDlqJob>(
    EMAIL_DLQ_NAME,
    async (job) => {
      logger.error(
        {
          dlqJobId: job.id,
          originalJobId: job.data.originalJobId,
          originalJobName: job.data.originalJobName,
          type: job.data.payload.type,
          attemptsMade: job.data.attemptsMade,
          failedReason: job.data.failedReason,
          failedAt: job.data.failedAt,
        },
        "Email DLQ job requires attention",
      );
    },
    {
      connection: redis,
      concurrency: 1,
    },
  );

  worker.on("ready", () => {
    logger.info("Email DLQ worker is ready");
  });

  worker.on("completed", (job) => {
    logger.info(
      {
        jobId: job.id,
      },
      "Email DLQ job processed",
    );
  });

  worker.on("failed", (job, error) => {
    logger.error(
      {
        jobId: job?.id,
        err: error,
      },
      "Email DLQ worker failed",
    );
  });

  worker.on("error", (error) => {
    logger.error(
      {
        err: error,
      },
      "Email DLQ worker error",
    );
  });

  return worker;
};

const emailDlqWorker = createEmailDlqWorker();

logger.info("Email DLQ worker started");