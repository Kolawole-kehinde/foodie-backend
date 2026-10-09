import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../docs/swagger.js";
import { notFound } from "../middlewares/notFound.js";
import { errorHandler } from "../middlewares/errorHandler.js";
import { startJobs } from "../jobs/start-jobs.js";

import {
  authRoutes,
  emailDlqRoutes,
  media,
  profile,
  rolePermissionRoutes,
  roleRoutes,
  userRoleRoutes,
  permissionRoutes,
  userRoutes,
  catalog,
  inventory,
  cart,
  order,
  outbox,
  payment,
  notification,
} from "./container.js";

export function createApp(): Express {
  const app = express();

  app.set("trust proxy", true);

  /*
   * ------------------------------------------------------------
   * Raw payment webhook body
   * ------------------------------------------------------------
   *
   * Must come BEFORE express.json().
   *
   * Payment provider signature verification requires the
   * original raw request body.
   */
  app.use(
    "/api/v1/payments/webhook",
    express.raw({
      type: "application/json",
    }),
  );

  /*
   * Normal JSON requests.
   */
  app.use(express.json());

  app.use(cookieParser());

  app.use(
    express.urlencoded({
      extended: true,
    }),
  );

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/api/v1/auth", authRoutes);

  app.use("/api/v1/admin/email-dlq", emailDlqRoutes);

  app.use("/api/v1/media", media.mediaUploadRoutes);

  app.use("/api/v1", profile.profileRoutes);

  app.use("/api/v1/roles", roleRoutes);

  app.use("/api/v1/roles", rolePermissionRoutes);

  app.use("/api/v1/users", userRoutes);

  app.use("/api/v1/users", userRoleRoutes);

  app.use("/api/v1/permissions", permissionRoutes);

  app.use("/api/v1/catalog", catalog.routes);

  app.use("/api/v1/inventory", inventory.inventoryRoutes);

  app.use("/api/v1/cart", cart.cartRoutes);

  app.use("/api/v1/orders", order.orderRoutes);

  /*
   * Payment routes.
   */
  app.use("/api/v1/payments", payment.paymentRoutes);

   /*
   * Nofifications routes.
   */
  app.use("api/v1/notification", notification.notificationRoutes)

 /*
 * Start all scheduled jobs.
 */
startJobs({
  orderService: order.orderService,
  outboxPublisherService: outbox.outboxPublisherService,

  paymentRepository: payment.paymentRepository,
  paymentRefundRepository: payment.paymentRepository,
  paymentReconciliationService:
    payment.paymentReconciliationService,
  paymentRefundService: payment.paymentRefundService,
});

  /*
   * 404 handler must come after all routes.
   */
  app.use(notFound);

  /*
   * Global error handler must be last.
   */
  app.use(errorHandler);

  return app;
}
