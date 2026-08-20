import nodemailer from "nodemailer";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";

const transporter = nodemailer.createTransport({
  host: env.mail.HOST,
  port: env.mail.PORT,
  secure: env.mail.PORT === 465,
  auth: {
    user: env.mail.USER,
    pass: env.mail.PASS,
  },
});

export const createEmailService = () => {
  const sendVerificationEmail = async (
    email: string,
    verificationToken: string
  ) => {
    const verificationUrl =
      `${env.mail.CLIENT_URL}/verify-email?token=${verificationToken}`;

   logger.info(
    {
      email,
      verificationToken,
      verificationUrl,
    },
    "Verification email generated"
  );
    await transporter.sendMail({
      from: env.mail.FROM,
      to: email,
      subject: "Verify your email",
      text: `Please verify your email by visiting: ${verificationUrl}`,
      html: `
        <h2>Verify your email</h2>

        <p>
          Please click the link below to verify your email address.
        </p>

        <a href="${verificationUrl}">
          Verify Email
        </a>

        <p>
          This link expires in 30 minutes.
        </p>
      `,
    });
  };

  return {
    sendVerificationEmail,
  };
};

export type EmailService =
  ReturnType<typeof createEmailService>;