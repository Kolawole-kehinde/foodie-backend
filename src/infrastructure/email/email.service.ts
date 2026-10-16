
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { emailTransporter } from "./email.transporter.js";
import { forgotPasswordTemplate } from "./templates/forgot-password.template.js";
import { verifyEmailTemplate } from "./templates/verify-email.template.js";

export const createEmailService = () => {
  const sendVerificationEmail = async (
    email: string,
    otp: string,
  ): Promise<void> => {
    const emailContent = verifyEmailTemplate(otp);

    await emailTransporter.sendMail({
      from: env.mail.FROM,
      to: email,
      ...emailContent,
    });

    logger.info("Verification email sent successfully");
  };

  const sendForgotPasswordEmail = async (
    email: string,
    resetUrl: string,
  ): Promise<void> => {
    const emailContent = forgotPasswordTemplate(resetUrl);

    await emailTransporter.sendMail({
      from: env.mail.FROM,
      to: email,
      ...emailContent,
    });

    logger.info("Password reset email sent successfully");
  };

  return {
    sendVerificationEmail,
    sendForgotPasswordEmail,
  };
};

export type EmailService = ReturnType<typeof createEmailService>;
