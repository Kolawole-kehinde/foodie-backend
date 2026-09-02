import { Queue } from "bullmq/dist/esm/classes/index.js";
import { redis } from "../../database/redis/client.js";

export const EMAIL_QUEUE_NAME = "email";

export type VerificationEmailJob = {
  type: "VERIFICATION_EMAIL";
  email: string;
  verificationToken: string;
};

export type PasswordResetEmailJob = {
  type: "PASSWORD_RESET_EMAIL";
  email: string;
  resetUrl: string;
};

export type EmailJob = VerificationEmailJob | PasswordResetEmailJob;

export const emailQueue = new Queue<EmailJob>(
  EMAIL_QUEUE_NAME,
  {
    connection: redis,
  }
);