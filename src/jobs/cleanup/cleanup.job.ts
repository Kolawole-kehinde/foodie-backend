import cron from "node-cron";
import { logger } from "../../config/logger.js";
import { createCleanupService } from "./cleanup.service.js";


const cleanupService = createCleanupService();

const CLEANUP_SCHEDULE = "*/10 * * * *";

export const startCleanupJob = () => {
  cron.schedule(CLEANUP_SCHEDULE, async () => {
    logger.info(
      "[Cleanup] Cleanup job started",
    );

    try {
      const deletedRegistrations = await cleanupService.cleanupPendingRegistrations();

      const deletedUploads =  await cleanupService.cleanupMediaUploads();

      logger.info(
        {
          deletedRegistrations,
          deletedUploads,
        },
        "[Cleanup] Cleanup job completed",
      );
    } catch (error) {
      logger.error(
        {
          err: error,
        },
        "[Cleanup] Cleanup job failed",
      );
    }
  });

  logger.info(
    {
      schedule: CLEANUP_SCHEDULE,
    },
    "[Cleanup] Cron job started",
  );
};
