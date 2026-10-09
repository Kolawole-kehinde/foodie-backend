import { Router } from "express";
import type { RequestHandler } from "express";
import type { NotificationController } from "../controllers/notification.controller.js";

type NotificationRouteDependencies = {
  notificationController: NotificationController;
  authenticate: RequestHandler;
};

export const createNotificationRoutes = ({
  notificationController,
  authenticate,
}: NotificationRouteDependencies): Router => {
  const router = Router();

  // Read notifications
  router.get(
    "/",
    authenticate,
    notificationController.list,
  );

  router.get(
    "/:id",
    authenticate,
    notificationController.get,
  );

  // Mark notifications as read
  // Keep /read-all before /:id/read to avoid route ambiguity.
  router.patch(
    "/read-all",
    authenticate,
    notificationController.markAllAsRead,
  );

  router.patch(
    "/:id/read",
    authenticate,
    notificationController.markAsRead,
  );

  return router;
};