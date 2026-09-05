import { env } from "../../../config/env.js";

export const verifyEmailTemplate = (verificationToken: string) => {
    
  const verificationUrl = `${env.mail.CLIENT_URL}/verify-email?token=${verificationToken}`;

  return {
    subject: "Verify your email",

    text: `
      Please verify your email by visiting:
      ${verificationUrl}

      This link expires in 30 minutes.
    `,

    html: `
      <h2>Verify your email</h2>

      <p>
        Please click the link below to verify your email address.
      </p>

      <p>
        <a href="${verificationUrl}">
          Verify Email
        </a>
      </p>

      <p>
        This link expires in 30 minutes.
      </p>
    `,
  };
};
