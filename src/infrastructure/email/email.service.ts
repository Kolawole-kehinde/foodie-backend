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
    verificationToken: string,
  ) => {
    const verificationUrl =
      `${env.mail.CLIENT_URL}/verify-email?token=${verificationToken}`;

    logger.info(
      {
       email,
      verificationToken,
      verificationUrl,
      },
      "Sending verification email"
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

  const sendPasswordResetEmail = async ( email: string, resetUrl: string) => {
    logger.info(
      {
        email,
        
      },
      "Sending password reset email"
    );

    await transporter.sendMail({
      from: env.mail.FROM,
      to: email,
      subject: "Reset your password",
      text: `
        We received a request to reset your password.

        Please use the following link to reset your password:
        ${resetUrl}

        This link expires in ${env.auth.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES} minutes.

        If you did not request a password reset, you can safely ignore this email.
      `,
      html: `
        <h2>Reset your password</h2>

        <p>
          We received a request to reset your password.
        </p>

        <p>
          Click the button below to create a new password.
        </p>

        <p>
          <a href="${resetUrl}">
            Reset Password
          </a>
        </p>

        <p>
          This link expires in
          ${env.auth.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES} minutes.
        </p>

        <p>
          If you did not request a password reset, you can safely ignore this email.
        </p>
      `,
    });
  };

  return {
    sendVerificationEmail,
    sendPasswordResetEmail,
  };
};

export type EmailService =
  ReturnType<typeof createEmailService>;