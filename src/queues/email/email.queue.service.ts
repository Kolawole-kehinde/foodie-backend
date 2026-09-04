import { emailQueue } from "./email.queue.js";

export const createEmailQueueService = () => {
  // Queue a verification email for background processing
  const sendVerificationEmail = async (
    email: string,
    verificationToken: string,
  ) => {
    await emailQueue.add(
      "verification-email",
      {
        type: "VERIFICATION_EMAIL",
        email,
        verificationToken,
      },
      {
        // Retry the job up to 3 times if email delivery fails
        attempts: 3,

        // Wait progressively longer between failed attempts
        backoff: {
          type: "exponential",
          delay: 1000,
        },

        // Remove successfully processed jobs from Redis
        removeOnComplete: true,

        // Keep failed jobs in Redis for inspection or manual retry
        removeOnFail: false,
      },
    );
  };

  // Queue a forgot-password email for background processing
  const sendForgotPasswordEmail = async ( email: string, resetUrl: string,) => {
    
    await emailQueue.add(
      "forgot-password-email",
      {
        type: "PASSWORD_RESET_EMAIL",
        email,
        resetUrl,
      },
      {
        // Retry the job up to 3 times if email delivery fails
        attempts: 3,

        // Wait progressively longer between failed attempts
        backoff: {
          type: "exponential",
          delay: 1000,
        },

        // Remove successfully processed jobs from Redis
        removeOnComplete: true,

        // Keep failed jobs in Redis for inspection or manual retry
        removeOnFail: false,
      },
    );
  };

  return {
    sendVerificationEmail,
    sendForgotPasswordEmail,
  };
};

export type EmailQueueService =ReturnType<typeof createEmailQueueService>;
