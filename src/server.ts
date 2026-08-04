// import { createApp } from "./app.js";
// import { env } from "./config/env.js";
// import { logger } from "./config/logger.js";




// const app = createApp()

// app.listen(env.port, () => {
//   logger.info(`Server is running on port ${env.port} in ${env.nodeEnv} mode`)
// })



import { createServer } from "node:http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
// import { env } from "@/config";
import { logger } from "./config/logger.js";

async function bootstrap() {
  try {
    logger.info("Starting application...");

    /**
     * Later we'll connect:
     *
     * await prisma.$connect();
     * await redis.connect();
     */

    const app = createApp();

    const server = createServer(app);

    server.listen(env.app.PORT, () => {
      logger.info(
        {
          port: env.app.PORT,
          environment: env.app.NODE_ENV,
        },
        "Server started successfully"
      );
    });

 
    //  Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, "Shutdown signal received");

      server.close(async () => {
        try {
          /**
           * Later:
           *
           * await prisma.$disconnect();
           * await redis.quit();
           */

          logger.info("Server shut down successfully");

          process.exit(0);
        } catch (error) {
          logger.error({ error }, "Error during shutdown");

          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
  } catch (error) {
    logger.fatal({ error }, "Application failed to start");

    process.exit(1);
  }
}

void bootstrap();