
import { createServer } from "node:http";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { createApp } from "./app.js";
import { prisma } from "../database/prisma/client.js";
import { connectRedis, redis } from "../database/redis/client.js";
import {
  notification,
  orderPaymentConsumer,
  outbox,
} from "./container.js";

async function bootstrap() {
  try {
    logger.info("Starting application...");

    await connectRedis();

    await outbox.eventPublisher.connect();

    await orderPaymentConsumer.connect();
    await orderPaymentConsumer.start();

    await notification.notificationConsumer.connect();
    await notification.notificationConsumer.start();

    // Start background email delivery polling.
    notification.notificationDeliveryRunner.start();

    const app = createApp();
    const server = createServer(app);



    server.listen(env.app.PORT, () => {
      logger.info(
        {
          port: env.app.PORT,
          environment: env.app.NODE_ENV,
        },
        "Server started successfully",
      );
    });



    let shuttingDown = false;

    const shutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;

      logger.info({ signal }, "Shutdown signal received");

      try {
        // Stop accepting new HTTP connections.
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        });

        // Stop polling and wait for the active delivery batch.
        await notification.notificationDeliveryRunner.stop();

        await notification.notificationConsumer.disconnect();
        await orderPaymentConsumer.disconnect();
        await outbox.eventPublisher.disconnect();

        await prisma.$disconnect();
        await redis.quit();

        logger.info("Server shut down successfully");
        process.exit(0);
      } catch (error) {
        logger.error({ err: error }, "Error during shutdown");
        process.exit(1);
      }
    };

    process.on("SIGINT", () => {
      void shutdown("SIGINT");
    });

    process.on("SIGTERM", () => {
      void shutdown("SIGTERM");
    });
  } catch (error) {
    logger.fatal({ err: error }, "Application failed to start");
    process.exit(1);
  }
}

void bootstrap();
