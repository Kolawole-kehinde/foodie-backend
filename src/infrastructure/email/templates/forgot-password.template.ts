
import { env } from "../../../config/env.js";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character]!;
  });

export const forgotPasswordTemplate = (resetUrl: string) => {
  const expiration =
    env.auth.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES;

  const safeResetUrl = escapeHtml(resetUrl);

  return {
    subject: "Reset your password",

    text: [
      "We received a request to reset your password.",
      "",
      "Use the following link to reset your password:",
      resetUrl,
      "",
      `This link expires in ${expiration} minutes.`,
      "",
      "If you did not request a password reset, you can safely ignore this email.",
    ].join("\n"),

    html: `
      <div style="max-width:480px;margin:40px auto;padding:32px;font-family:Arial,sans-serif;color:#1f2937;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your password.</p>
        <p>Click the button below to choose a new password.</p>
        <p style="margin:24px 0;">
          <a href="${safeResetUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;">
            Reset Password
          </a>
        </p>
        <p>This link expires in ${expiration} minutes.</p>
        <p>If you did not request a password reset, you can safely ignore this email.</p>
      </div>
    `.trim(),
  };
};
