
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

const classifyMailError = (error: unknown): EmailProviderError => {
  const details = (
    error && typeof error === "object" ? error : {}
  ) as MailErrorDetails;

  const code = details.code;
  const responseCode = details.responseCode;
  const message = details.message ?? "Email provider request failed";

  // SMTP 4xx responses are generally temporary; SMTP 5xx responses
  // are generally permanent, except 421 which means the service is unavailable.
  if (responseCode === 421 || (responseCode !== undefined &&
      responseCode >= 400 && responseCode < 500)) {
    return new EmailProviderError(message, true, code, responseCode);
  }

  if (responseCode !== undefined && responseCode >= 500) {
    return new EmailProviderError(message, false, code, responseCode);
  }

  if (code && RETRYABLE_NETWORK_CODES.has(code)) {
    return new EmailProviderError(message, true, code, responseCode);
  }

  // Unknown errors are retried cautiously because they may be transient.
  return new EmailProviderError(message, true, code, responseCode);
};

export const createEmailProvider = (): ChannelProvider => {
  const send = async (
    input: ChannelDeliveryInput,
  ): Promise<ChannelDeliveryResult> => {
    // Resolve the recipient from the trusted user record.
    const email = input.recipientEmail;

    if (!email) {
      throw new EmailProviderError(
        `Email address is missing for notification ${input.notificationId}`,
        false,
        "MISSING_RECIPIENT",
      );
    }

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
        to: email,
        subject: input.title,
        text: input.message,
        html: `<h2>${input.title}</h2><p>${input.message}</p>`,
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