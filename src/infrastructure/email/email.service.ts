import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { emailTransporter } from "./email.transporter.js";
import { verifyEmailTemplate } from "./templates/verify-email.template.js";
import { forgotPasswordTemplate } from "./templates/forgot-password.template.js";

export const createEmailService = () => {
  const sendVerificationEmail = async (email: string, verificationToken: string,) => {
    const emailContent = verifyEmailTemplate(verificationToken);

    logger.info(
      { email },
      "Sending verification email",
    );

    await emailTransporter.sendMail({
      from: env.mail.FROM,
      to: email,
      ...emailContent,
    });
  };

  const sendForgotPasswordEmail = async (
    email: string,
    resetUrl: string,
  ) => {
    const emailContent =
      forgotPasswordTemplate(resetUrl);

    logger.info(
      { email },
      "Sending forgot password email",
    );

    await emailTransporter.sendMail({
      from: env.mail.FROM,
      to: email,
      ...emailContent,
    });
  };

  return {
    sendVerificationEmail,
    sendForgotPasswordEmail,
  };
};

export type EmailService =  ReturnType<typeof createEmailService>;
