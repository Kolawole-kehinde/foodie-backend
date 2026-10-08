import type { Prisma } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

type FindUserNotificationsOptions = {
  userId: string;
  limit: number;
  cursor?: string;
  unreadOnly?: boolean;
};

export const createNotificationRepository = (db: DatabaseClient) => {
    
  const createNotification = async (data: Prisma.NotificationCreateInput) => {
    return db.notification.create({
      data,
    });
  };

  const findById = async (id: string) => {
    return db.notification.findUnique({
      where: {
        id,
      },
    });
  };

  const findByEventId = async (eventId: string) => {
    return db.notification.findFirst({
      where: {
        eventId,
      },
    });
  };

  const findUserNotifications = async ({
    userId,
    limit,
    cursor,
    unreadOnly,
  }: FindUserNotificationsOptions) => {
    return db.notification.findMany({
      where: {
        userId,
        ...(unreadOnly ? { readAt: null } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      ...(cursor
        ? {
            skip: 1,
            cursor: {
              id: cursor,
            },
          }
        : {}),
    });
  };

  const markAsRead = async (id: string, userId: string) => {
    return db.notification.updateMany({
      where: {
        id,
        userId,
        readAt: null,
      },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });
  };

  const markAllAsRead = async (userId: string) => {
    return db.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });
  };

  return {
    createNotification,
    findById,
    findByEventId,
    findUserNotifications,
    markAsRead,
    markAllAsRead,
  };
};