// import { createApp } from "./app.js";
// import { env } from "./config/env.js";
// import { logger } from "./config/logger.js";




// const app = createApp()

// app.listen(env.port, () => {
//   logger.info(`Server is running on port ${env.port} in ${env.nodeEnv} mode`)
// })



import { createServer } from "node:http";

import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { createApp } from "./app.js";
import { prisma } from "../database/prisma/client.js";
import { redis } from "../database/redis/client.js";

// import { env } from "@/config";


async function bootstrap() {
  try {
    logger.info("Starting application...");

    await redis.connect();

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

   process.on("SIGINT", async () => {
  await prisma.$disconnect();
await redis.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
  } catch (error) {
    logger.fatal({ error }, "Application failed to start");

    process.exit(1);
  }
}

void bootstrap();