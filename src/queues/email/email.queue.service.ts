
import { emailQueue } from "./email.queue.js";

export const createEmailQueueService = () => {
  const sendVerificationEmail = async (
    email: string,
    otp: string,
  ): Promise<void> => {
    await emailQueue.add("verification-email", {
      type: "VERIFICATION_EMAIL",
      email,
      otp,
    });
  };

  const sendForgotPasswordEmail = async (
    email: string,
    resetUrl: string,
  ): Promise<void> => {
    await emailQueue.add("forgot-password-email", {
      type: "PASSWORD_RESET_EMAIL",
      email,
      resetUrl,
    });
  };

  return {
    sendVerificationEmail,
    sendForgotPasswordEmail,
  };
};

export type EmailQueueService = ReturnType<
  typeof createEmailQueueService
>;
