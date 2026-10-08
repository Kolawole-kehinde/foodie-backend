import type { Prisma } from "@prisma/client";

import type { NotificationRepository } from "../repositories/notification.repository.js";

type CreateNotificationServiceDependencies = {
  notificationRepository: NotificationRepository;
};

type ListNotificationsInput = {
  userId: string;
  limit: number;
  cursor?: string;
  unreadOnly?: boolean;
};

export const createNotificationService = ({
  notificationRepository,
}: CreateNotificationServiceDependencies) => {
  const create = async (data: Prisma.NotificationCreateInput) => {
    return notificationRepository.createNotification(data);
  };

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

  return {
    create,
    get,
    list,
    markAsRead,
    markAllAsRead,
  };
};
