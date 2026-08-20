import cron from "node-cron";

import {createPendingRegistrationCleanupService,} from "./pending-registration-cleanup.service.js";
import { logger } from "../../config/logger.js";



const cleanupService = createPendingRegistrationCleanupService();

export const startPendingRegistrationCleanupJob = () => {
  cron.schedule("*/10 * * * *", async () => {
    try {
      const deletedCount = await cleanupService.cleanup();

      logger.info(
        {
          deletedCount,
        },
        "[PendingRegistrationCleanup] Cleanup completed"
      );
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "[PendingRegistrationCleanup] Cleanup failed"
      );
    }
  });

  logger.info(
    "[PendingRegistrationCleanup] Cron job started"
  );
};