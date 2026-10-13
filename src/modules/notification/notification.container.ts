
import type { RequestHandler } from "express";
import type { PrismaClient } from "@prisma/client";
import { createNotificationRepository } from "./repositories/notification.repository.js";
import { createNotificationService } from "./services/notification.service.js";
import { createNotificationController } from "./controllers/notification.controller.js";
import { createNotificationRoutes } from "./routes/notification.routes.js";

import { createNotificationConsumer } from "./consumers/notification.consumer.js";
import { createNotificationDeliveryWorker } from "./workers/notification-delivery.worker.js";
import { createNotificationDeliveryRunner } from "./workers/notification-delivery.runner.js";
import { env } from "../../config/env.js";
import { createOrderNotificationHandler } from "./handlers/order-notification.handler.js";
import { createPaymentNotificationHandler } from "./handlers/payment-notification.handler.js";

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



  const paymentNotificationHandler = createPaymentNotificationHandler({
  notificationService,
  clientUrl: env.mail.CLIENT_URL,
});

const orderNotificationHandler = createOrderNotificationHandler({
  notificationService,
  clientUrl: env.mail.CLIENT_URL,
});

const notificationConsumer = createNotificationConsumer({
  db,
  handler: paymentNotificationHandler,
  orderNotificationHandler,
});

  const notificationDeliveryWorker =
    createNotificationDeliveryWorker({ db });

  const notificationDeliveryRunner =
    createNotificationDeliveryRunner({
      worker: notificationDeliveryWorker,
      pollIntervalMs: 5_000,
      batchSize: 20,
    });


  return {
    notificationRepository,
    notificationService,
    notificationController,
    notificationRoutes,
    paymentNotificationHandler,
    orderNotificationHandler,
    notificationConsumer,
    notificationDeliveryWorker,
    notificationDeliveryRunner,
  };
};
