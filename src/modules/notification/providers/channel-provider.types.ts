import type { NotificationChannel } from "@prisma/client";

export type ChannelDeliveryInput = {
  notificationId: string;
  deliveryId: string;
  userId: string;
  recipientEmail: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

export type ChannelDeliveryResult = {
  providerMessageId?: string;
};

export interface ChannelProvider {
  readonly channel: NotificationChannel;

  send(
    input: ChannelDeliveryInput,
  ): Promise<ChannelDeliveryResult>;
}