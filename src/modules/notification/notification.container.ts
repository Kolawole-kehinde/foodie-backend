import type { RequestHandler } from "express";
import { createNotificationRepository } from "./repositories/notification.repository.js";
import { createNotificationService } from "./services/notification.service.js";
import { createNotificationController } from "./controllers/notification.controller.js";
import { createNotificationRoutes } from "./routes/notification.routes.js";
import { createPaymentSucceededNotificationHandler } from "./handlers/payment-succeeded-notification.handler.js";
import { createNotificationConsumer } from "./consumers/notification.consumer.js";
import { createNotificationDeliveryWorker } from "./workers/notification-delivery.worker.js";
import type { PrismaClient } from "@prisma/client";

type NotificationDependencies = {
  db: PrismaClient;
  authenticate: RequestHandler;
};


export const createNotificationDependencies = ({
  db,
  authenticate,
}: NotificationDependencies) => {
  const notificationRepository = createNotificationRepository(db);

const notificationService = createNotificationService({
  db,
  notificationRepository,
});
  const notificationController = createNotificationController({
    notificationService,
  });

  const notificationRoutes = createNotificationRoutes({
    notificationController,
    authenticate,
  });

  const paymentSucceededNotificationHandler =
  createPaymentSucceededNotificationHandler({
    notificationService,
  });

const notificationConsumer = createNotificationConsumer({
  db,
  handler: paymentSucceededNotificationHandler,
});

const notificationDeliveryWorker =
  createNotificationDeliveryWorker({ db });

  return {
    notificationRepository,
    notificationService,
    notificationController,
    notificationRoutes,
    paymentSucceededNotificationHandler,
    notificationConsumer,
    notificationDeliveryWorker
  };
};