import { NotificationChannel } from "@prisma/client";
import { env } from "../../../../config/env.js";
import { logger } from "../../../../config/logger.js";
import type {
  ChannelDeliveryInput,
  ChannelDeliveryResult,
  ChannelProvider,
} from "../channel-provider.types.js";
import { emailTransporter } from "../../../../infrastructure/email/email.transporter.js";

export const createEmailProvider = (): ChannelProvider => {
  const send = async (
    input: ChannelDeliveryInput,
  ): Promise<ChannelDeliveryResult> => {
    // The recipient must be resolved from the trusted user record.
    const email = input.metadata?.email;

    if (typeof email !== "string" || !email) {
      throw new Error(
        `Email address is missing for notification ${input.notificationId}`,
      );
    }

    logger.info(
      {
        notificationId: input.notificationId,
        deliveryId: input.deliveryId,
      },
      "Sending notification email",
    );

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
  };

  return {
    channel: NotificationChannel.EMAIL,
    send,
  };
};