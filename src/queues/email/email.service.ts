import { emailQueue } from "./email.queue.js";

export const createEmailQueueService = () => {
  const sendVerificationEmail = async (
    email: string,
    verificationToken: string
  ) => {
    await emailQueue.add(
      "verification-email",
      {
        type: "VERIFICATION_EMAIL",
        email,
        verificationToken,
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );
  };

  return {
    sendVerificationEmail,
  };
};

export type EmailQueueService = ReturnType<typeof createEmailQueueService>;