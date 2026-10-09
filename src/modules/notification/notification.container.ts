import type { RequestHandler } from "express";
import type { DatabaseClient } from "../../database/prisma/types.js";
import { createNotificationRepository } from "./repositories/notification.repository.js";
import { createNotificationService } from "./services/notification.service.js";
import { createNotificationController } from "./controllers/notification.controller.js";
import { createNotificationRoutes } from "./routes/notification.routes.js";

type NotificationDependencies = {
  db: DatabaseClient;
  authenticate: RequestHandler;
};


export const createNotificationDependencies = ({
  db,
  authenticate,
}: NotificationDependencies) => {
  const notificationRepository = createNotificationRepository(db);

  const notificationService = createNotificationService({
    notificationRepository,
  });

  const notificationController = createNotificationController({
    notificationService,
  });

  const notificationRoutes = createNotificationRoutes({
    notificationController,
    authenticate,
  });

  return {
    notificationRepository,
    notificationService,
    notificationController,
    notificationRoutes,
  };
};