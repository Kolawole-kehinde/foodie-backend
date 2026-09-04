import { env } from "../../../config/env.js";

export const forgotPasswordTemplate = (resetUrl: string) => {

  const expiration =  env.auth.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES;

  return {
    subject: "Reset your password",

    text: `
      We received a request to reset your password.

      Please use the following link to reset your password:
      ${resetUrl}

      This link expires in ${expiration} minutes.

      If you did not request a password reset,
      you can safely ignore this email.
    `,

    html: `
      <h2>Reset your password</h2>

      <p>
        We received a request to reset your password.
      </p>

      <p>
        Click the link below to create a new password.
      </p>

      <p>
        <a href="${resetUrl}">
          Reset Password
        </a>
      </p>

      <p>
        This link expires in ${expiration} minutes.
      </p>

      <p>
        If you did not request a password reset,
        you can safely ignore this email.
      </p>
    `,
  };
};
