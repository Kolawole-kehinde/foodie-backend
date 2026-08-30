import express, { type Express } from "express";
import { notFound } from "../middlewares/notFound.js";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "../docs/swagger.js";
import { errorHandler } from "../middlewares/errorHandler.js";
import { authRoutes } from "./container.js";
import { startPendingRegistrationCleanupJob } from "../jobs/pending-registration-cleanup/pending-registration-cleanup.job.js";
import cookieParser from "cookie-parser";

export function createApp(): Express {
  const app = express();

  startPendingRegistrationCleanupJob();

  app.set("trust proxy", true);

  app.use(express.json());
  app.use(cookieParser());
  app.use(express.urlencoded({ extended: true }));

  app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
  );

  app.use("/api/v1/auth", authRoutes);

  // 404 MUST come after all routes
  app.use(notFound);

  // Global error handler MUST be last
  app.use(errorHandler);

  return app;
}