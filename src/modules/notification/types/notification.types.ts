import type {
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from "@prisma/client";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  eventId: string;
  eventType: string;
  metadata?: Record<string, unknown>;
};

export type FindUserNotificationsOptions = {
  userId: string;
  limit: number;
  cursor?: string;
  unreadOnly?: boolean;
};

export type NotificationRepository = {
  createNotification: (input: CreateNotificationInput) => Promise<unknown>;

  findById: (id: string) => Promise<unknown>;

  findByEventId: (eventId: string) => Promise<unknown>;

  findUserNotifications: ( options: FindUserNotificationsOptions) => Promise<unknown>;

  markAsRead: (id: string, userId: string) => Promise<unknown>;

  markAllAsRead: (userId: string) => Promise<number>;
};
