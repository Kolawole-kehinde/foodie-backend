import { Job } from "bullmq";
import {emailDlq, emailQueue,type EmailDlqJob,} from "../../queues/email/email.queue.js";
import { NotFoundError } from "../../shared/errors/NotFoundError.js";

export const createEmailDlqService = () => {
  const replayJob = async (jobId: string) => {
    const dlqJob = await Job.fromId<EmailDlqJob>(
      emailDlq,
      jobId,
    );

    if (!dlqJob) {
      throw new NotFoundError("DLQ job not found");
    }

    await emailQueue.add(
      dlqJob.data.originalJobName,
      dlqJob.data.payload,
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    );

    await dlqJob.remove();

    return {
      message: "Email job replayed successfully",
    };
  };

  return {
    replayJob,
  };
};

export type EmailDlqService = ReturnType <typeof createEmailDlqService>;