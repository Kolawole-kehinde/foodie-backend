import type { DeliveryStatus, NotificationChannel } from "@prisma/client";

export type CreateDeliveryInput = {
  notificationId: string;
  channel: NotificationChannel;
};

export type UpdateDeliveryStatusInput = {
  status: DeliveryStatus;
  failureReason?: string;
  providerMessageId?: string;
  deliveredAt?: Date;
};

export type NotificationDeliveryRepository = {
  createDelivery: (input: CreateDeliveryInput) => Promise<unknown>;

  findDelivery: (id: string) => Promise<unknown>;

  updateDeliveryStatus: (
    id: string,
    input: UpdateDeliveryStatusInput,
  ) => Promise<unknown>;

  incrementAttempts: (id: string) => Promise<unknown>;
};
