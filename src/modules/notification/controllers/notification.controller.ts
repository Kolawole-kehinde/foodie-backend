import type { RequestHandler } from "express";

import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";

import type { NotificationService } from "../services/notification.service.js";
import {
  listNotificationsSchema,
  notificationIdSchema,
} from "../dto/notification.dto.js";

type NotificationControllerDependencies = {
  notificationService: NotificationService;
};

export type NotificationController = {
  list: RequestHandler;
  get: RequestHandler;
  markAsRead: RequestHandler;
  markAllAsRead: RequestHandler;
};

export const createNotificationController = ({
  notificationService,
}: NotificationControllerDependencies): NotificationController => {
    
  const list = asyncHandler(async (req, res) => {
    const result = listNotificationsSchema.safeParse(req.query);

    if (!result.success) {
      throw new BadRequestError(result.error.message);
    }

    const notifications = await notificationService.list({
      ...result.data,
      userId: req.user.id,
    });

    res.status(200).json({
      success: true,
      data: notifications,
    });
  });

  const get = asyncHandler(async (req, res) => {
    const result = notificationIdSchema.safeParse(req.params);

    if (!result.success) {
      throw new BadRequestError(result.error.message);
    }

    const notification = await notificationService.get(result.data.id);

    if (!notification || notification.userId !== req.user.id) {
      throw new BadRequestError("Notification not found");
    }

    res.status(200).json({
      success: true,
      data: notification,
    });
  });

  const markAsRead = asyncHandler(async (req, res) => {
    const result = notificationIdSchema.safeParse(req.params);

    if (!result.success) {
      throw new BadRequestError(result.error.message);
    }

    const updated = await notificationService.markAsRead(
      result.data.id,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      data: updated,
    });
  });

  const markAllAsRead = asyncHandler(async (req, res) => {
    const result = await notificationService.markAllAsRead(req.user.id);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  return {
    list,
    get,
    markAsRead,
    markAllAsRead,
  };
};
