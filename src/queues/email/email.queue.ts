import { Queue } from "bullmq";
import { redis } from "../../database/redis/client.js";
export const EMAIL_QUEUE_NAME = "email";
export const EMAIL_DLQ_NAME = "email-dlq";


export type EmailDlqJob = {
  originalJobId: string;
  originalJobName: string;
  payload: EmailJob;
  attemptsMade: number;
  failedReason: string;
  failedAt: string;
};

export type VerificationEmailJob = {
  type: "VERIFICATION_EMAIL";
  email: string;
  verificationToken: string;
};

export type ForgotPasswordEmailJob = {
  type: "PASSWORD_RESET_EMAIL";
  email: string;
  resetUrl: string;
};

export type EmailJob =
  | VerificationEmailJob
  | ForgotPasswordEmailJob;
  

export const emailQueue = new Queue<EmailJob>(
  EMAIL_QUEUE_NAME,
  {
    connection: redis,
  },
);

export const emailDlq = new Queue<EmailDlqJob>(
  EMAIL_DLQ_NAME,
  {
    connection: redis,
  },
);