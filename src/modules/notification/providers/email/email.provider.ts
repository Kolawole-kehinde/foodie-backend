import { NotificationChannel } from "@prisma/client";
import { env } from "../../../../config/env.js";
import { logger } from "../../../../config/logger.js";
import type {
  ChannelDeliveryInput,
  ChannelDeliveryResult,
  ChannelProvider,
} from "../channel-provider.types.js";
import { emailTransporter } from "../../../../infrastructure/email/email.transporter.js";
import { EmailProviderError } from "./email-provider.error.js";

type MailErrorDetails = {
  code?: string;
  responseCode?: number;
  response?: string;
  message?: string;
};

type EmailTemplateContent = {
  subject: string;
  text: string;
  html: string;
};

const RETRYABLE_NETWORK_CODES = new Set([
  "ETIMEDOUT",
  "ECONNECTION",
  "ECONNRESET",
  "ECONNREFUSED",
  "EHOSTUNREACH",
  "EPIPE",
  "EAI_AGAIN",
  "ESOCKET",
]);

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getEmailTemplate = (
  metadata: unknown,
): EmailTemplateContent | undefined => {
  if (!isRecord(metadata) || !isRecord(metadata.email)) {
    return undefined;
  }

  const email = metadata.email;

  if (
    typeof email.subject !== "string" ||
    typeof email.text !== "string" ||
    typeof email.html !== "string"
  ) {
    return undefined;
  }

  return {
    subject: email.subject,
    text: email.text,
    html: email.html,
  };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const classifyMailError = (error: unknown): EmailProviderError => {
  const details = (
    error && typeof error === "object" ? error : {}
  ) as MailErrorDetails;

  const code = details.code;
  const responseCode = details.responseCode;
  const message = details.message ?? "Email provider request failed";

  if (
    responseCode === 421 ||
    (responseCode !== undefined &&
      responseCode >= 400 &&
      responseCode < 500)
  ) {
    return new EmailProviderError(message, true, code, responseCode);
  }

  if (responseCode !== undefined && responseCode >= 500) {
    return new EmailProviderError(message, false, code, responseCode);
  }

  if (code && RETRYABLE_NETWORK_CODES.has(code)) {
    return new EmailProviderError(message, true, code, responseCode);
  }

  return new EmailProviderError(message, true, code, responseCode);
};

export const createEmailProvider = (): ChannelProvider => {
  const send = async (
    input: ChannelDeliveryInput,
  ): Promise<ChannelDeliveryResult> => {
    const emailAddress = input.recipientEmail;

    if (!emailAddress) {
      throw new EmailProviderError(
        `Email address is missing for notification ${input.notificationId}`,
        false,
        "MISSING_RECIPIENT",
      );
    }

    const template = getEmailTemplate(input.metadata);

    const subject = template?.subject ?? input.title;
    const text = template?.text ?? input.message;
    const html =
      template?.html ??
      `<h2>${escapeHtml(input.title)}</h2><p>${escapeHtml(input.message)}</p>`;

    logger.info(
      {
        notificationId: input.notificationId,
        deliveryId: input.deliveryId,
      },
      "Sending notification email",
    );

    try {
      const result = await emailTransporter.sendMail({
        from: env.mail.FROM,
        to: emailAddress,
        subject,
        text,
        html,
      });

      return {
        providerMessageId: result.messageId,
      };
    } catch (error) {
      const classifiedError = classifyMailError(error);

      logger.warn(
        {
          notificationId: input.notificationId,
          deliveryId: input.deliveryId,
          providerCode: classifiedError.providerCode,
          responseCode: classifiedError.responseCode,
          retryable: classifiedError.retryable,
        },
        "Email provider request failed",
      );

      throw classifiedError;
    }
  };

  return {
    channel: NotificationChannel.EMAIL,
    send,
  };
};