import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../docs/swagger.js";
import { notFound } from "../middlewares/notFound.js";
import { errorHandler } from "../middlewares/errorHandler.js";
import {
  authRoutes,
  emailDlqRoutes,
  media,
  profile,
  rolePermissionRoutes,
  roleRoutes,
  userRoleRoutes,
} from "./container.js";
import { startCleanupJob } from "../jobs/cleanup/cleanup.job.js";

export function createApp(): Express {
  const app = express();

  startCleanupJob();

  app.set("trust proxy", true);

  app.use(express.json());
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/admin/email-dlq", emailDlqRoutes);
  app.use("/api/v1/media", media.mediaUploadRoutes);
  app.use("/api/v1", profile.profileRoutes);
  app.use("/api/v1/roles", roleRoutes);
  app.use("/api/v1/users", userRoleRoutes);
  app.use("/api/v1/users", rolePermissionRoutes);

  // 404 MUST come after all routes
  app.use(notFound);

  // Global error handler MUST be last
  app.use(errorHandler);

  return app;
}
