
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { IdentityEvent } from "../../../shared/events/event.types.js";

type IdentityNotificationTemplateOptions = {
  verificationOtp?: string;
  resetUrl?: string;
};

type IdentityEmailTemplate = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

type InAppNotificationTemplate = {
  title: string;
  message: string;
};

type IdentityNotificationTemplateResult = {
  inApp: InAppNotificationTemplate | null;
  email: IdentityEmailTemplate;
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createEmail = ({
  to,
  subject,
  text,
  html,
}: IdentityEmailTemplate): IdentityEmailTemplate => ({
  to,
  subject,
  text,
  html,
});

export const identityNotificationTemplate = (
  event: IdentityEvent,
  options: IdentityNotificationTemplateOptions = {},
): IdentityNotificationTemplateResult => {
  const email = event.data.email;
  const safeEmail = escapeHtml(email);

  switch (event.eventType) {
    case EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_REQUESTED:
    case EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_RESENT: {
      if (!options.verificationOtp) {
        throw new Error(
          "A verification OTP must be supplied from a secure source.",
        );
      }

      const otp = options.verificationOtp;
      const safeOtp = escapeHtml(otp);
      const isResend =
        event.eventType ===
        EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_RESENT;

      const subject = isResend
        ? "Your new email verification code"
        : "Verify your email address";

      const heading = isResend
        ? "Your new verification code"
        : "Verify your email";

      const text = [
        `Hello,`,
        ``,
        isResend
          ? "You requested a new email verification code."
          : "Thank you for registering. Use the code below to verify your email address.",
        ``,
        `Verification code: ${otp}`,
        ``,
        "This code expires in 10 minutes. If you did not request this, you can ignore this email.",
      ].join("\n");

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
          <h2>${heading}</h2>
          <p>Use the following code to verify <strong>${safeEmail}</strong>.</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:6px">
            ${safeOtp}
          </p>
          <p>This code expires in 10 minutes.</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `;

      return {
        inApp: null,
        email: createEmail({ to: email, subject, text, html }),
      };
    }

    case EVENT_TYPES.IDENTITY_EMAIL_VERIFIED: {
      const subject = "Email verified successfully";
      const text =
        "Your email address has been verified successfully. You can now continue using your account.";

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
          <h2>Email verified successfully</h2>
          <p>Your email address <strong>${safeEmail}</strong> has been verified.</p>
          <p>You can now continue using your account.</p>
          <p>If you did not perform this action, please contact support.</p>
        </div>
      `;

      return {
        inApp: {
          title: "Email verified",
          message: "Your email address has been successfully verified.",
        },
        email: createEmail({ to: email, subject, text, html }),
      };
    }

    case EVENT_TYPES.IDENTITY_PASSWORD_RESET_REQUESTED: {
      if (!options.resetUrl) {
        throw new Error(
          "A password reset URL must be supplied from a secure source.",
        );
      }

      const resetUrl = options.resetUrl;
      const safeResetUrl = escapeHtml(resetUrl);
      const subject = "Reset your password";

      const text = [
        "We received a request to reset your password.",
        "",
        `Use this link to reset your password: ${resetUrl}`,
        "",
        "This link expires according to your password-reset policy.",
        "If you did not request a password reset, you can ignore this email.",
      ].join("\n");

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
          <h2>Reset your password</h2>
          <p>We received a request to reset the password for <strong>${safeEmail}</strong>.</p>
          <p>
            <a href="${safeResetUrl}"
               style="display:inline-block;padding:12px 20px;background:#222;color:#fff;text-decoration:none;border-radius:6px">
              Reset password
            </a>
          </p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `;

      return {
        inApp: null,
        email: createEmail({ to: email, subject, text, html }),
      };
    }

    case EVENT_TYPES.IDENTITY_PASSWORD_RESET_COMPLETED: {
      const subject = "Your password has been changed";
      const text =
        "Your password has been changed successfully. If you did not make this change, contact support immediately.";

      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
          <h2>Password changed successfully</h2>
          <p>The password for <strong>${safeEmail}</strong> has been changed.</p>
          <p>If you did not make this change, contact support immediately.</p>
        </div>
      `;

      return {
        inApp: {
          title: "Password changed",
          message: "Your password has been successfully changed.",
        },
        email: createEmail({ to: email, subject, text, html }),
      };
    }
  }
};
