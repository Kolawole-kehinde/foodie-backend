import { createServer } from "node:http";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { createApp } from "./app.js";
import { prisma } from "../database/prisma/client.js";
import { connectRedis, redis } from "../database/redis/client.js";



async function bootstrap() {
  try {
    logger.info("Starting application...");

    // Connect to Redis
    await connectRedis();

    // Create Express application
    const app = createApp();

    // Create HTTP server
    const server = createServer(app);

    // Start server
    server.listen(env.app.PORT, () => {
      logger.info({
          port: env.app.PORT,
          environment: env.app.NODE_ENV,
        },
        "Server started successfully",
      );
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Shutdown signal received");

      server.close(async () => {
        try {
          await prisma.$disconnect();
          await redis.quit();

          logger.info("Server shut down successfully");

          process.exit(0);
        } catch (error) {
          logger.error({ err: error }, "Error during shutdown");

          process.exit(1);
        }
      });
    };

    process.on("SIGINT", async () => {
      await shutdown("SIGINT");
    });

    process.on("SIGTERM", async () => {
      await shutdown("SIGTERM");
    });
  } catch (error) {
    logger.fatal({ err: error }, "Application failed to start");

    process.exit(1);
  }
}

void bootstrap();
