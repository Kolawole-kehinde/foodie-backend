
import { Queue } from "bullmq";

import { redis } from "../../database/redis/client.js";

export const EMAIL_QUEUE_NAME = "email";
export const EMAIL_DLQ_NAME = "email-dlq";

export const EMAIL_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 1_000,
  },
  removeOnComplete: {
    age: 60 * 60,
    count: 1_000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
    count: 5_000,
  },
};

export type VerificationEmailJob = {
  type: "VERIFICATION_EMAIL";
  email: string;
  otp: string;
};

export type ForgotPasswordEmailJob = {
  type: "PASSWORD_RESET_EMAIL";
  email: string;
  resetUrl: string;
};

export type EmailJob =
  | VerificationEmailJob
  | ForgotPasswordEmailJob;

export type EmailDlqJob = {
  originalJobId: string;
  originalJobName: string;
  payload: EmailJob;
  attemptsMade: number;
  failedReason: string;
  failedAt: string;
};

export const emailQueue = new Queue<EmailJob>(
  EMAIL_QUEUE_NAME,
  {
    connection: redis,
    defaultJobOptions: EMAIL_JOB_OPTIONS,
  },
);

export const emailDlq = new Queue<EmailDlqJob>(
  EMAIL_DLQ_NAME,
  {
    connection: redis,
    defaultJobOptions: {
      removeOnComplete: {
        age: 30 * 24 * 60 * 60,
        count: 5_000,
      },
      removeOnFail: {
        age: 30 * 24 * 60 * 60,
        count: 5_000,
      },
    },
  },
);
