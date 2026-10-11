import {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  PrismaClient,
  type Prisma,
} from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { createNotificationRepository } from "../repositories/notification.repository.js";
import { createNotificationDeliveryRepository } from "../repositories/notification-delivery.repository.js";
import { createNotificationPreferenceRepository } from "../repositories/notification-preference.repository.js";

type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  status: NotificationStatus;
  title: string;
  message: string;
  eventId: string;
  eventType: string;
  metadata?: Prisma.InputJsonValue;
};

type CreateNotificationServiceDependencies = {
  db: PrismaClient;
};

type ListNotificationsInput = {
  userId: string;
  limit: number;
  cursor?: string;
  unreadOnly?: boolean;
};

export const createNotificationService = ({
  db,
}: CreateNotificationServiceDependencies) => {
  // Read operations use repositories connected to the supplied database client.
  const notificationRepository = createNotificationRepository(db);

  const get = async (id: string) => {
    return notificationRepository.findById(id);
  };

  const list = async ({
    userId,
    limit,
    cursor,
    unreadOnly,
  }: ListNotificationsInput) => {
    return notificationRepository.findUserNotifications({
      userId,
      limit,
      cursor,
      unreadOnly,
    });
  };

  const markAsRead = async (id: string, userId: string) => {
    return notificationRepository.markAsRead(id, userId);
  };

  const markAllAsRead = async (userId: string) => {
    return notificationRepository.markAllAsRead(userId);
  };

  const create = async (data: CreateNotificationInput) => {
    return db.$transaction(async (tx) => {
      // Build repositories with the transaction client so all writes share
      // the same transaction and roll back together if any operation fails.
      const transactionNotificationRepository =
        createNotificationRepository(tx);

      const transactionDeliveryRepository =
        createNotificationDeliveryRepository(tx);

      const transactionPreferenceRepository =
        createNotificationPreferenceRepository(tx);

      // Create the in-app notification.
      const notification =
        await transactionNotificationRepository.createNotification({
          user: {
            connect: { id: data.userId },
          },
          type: data.type,
          status: data.status,
          title: data.title,
          message: data.message,
          eventId: data.eventId,
          eventType: data.eventType,
          ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        });

      // Check whether this user has disabled email for this notification type.
      const emailPreference =
        await transactionPreferenceRepository.findPreference(
          data.userId,
          data.type,
          NotificationChannel.EMAIL,
        );

      // No saved preference means email is enabled by default.
      if (emailPreference?.enabled !== false) {
        // Queue email delivery for the worker; do not send email in this transaction.
        await transactionDeliveryRepository.createDelivery({
          notification: {
            connect: { id: notification.id },
          },
          channel: NotificationChannel.EMAIL,
          status: "PENDING",
        });
      }

      return notification;
    });
  };

  return {
    create,
    get,
    list,
    markAsRead,
    markAllAsRead,
  };
};

export type NotificationService = ReturnType<typeof createNotificationService>;
