import { z } from "zod";

export const listNotificationsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),

  cursor: z.string().optional(),

  unreadOnly: z.coerce.boolean().default(false),
});

export const notificationIdSchema = z.object({
  id: z.string().min(1),
});

export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;

export type NotificationIdInput = z.infer<typeof notificationIdSchema>;
