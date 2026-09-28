import cron from "node-cron";
import type { CleanupService } from "./cleanup.service.js";
import { logger } from "../../config/logger.js";

const CLEANUP_SCHEDULE = "*/10 * * * *";

type CleanupJobDependencies = {
  cleanupService: CleanupService;
};

export const createCleanupJob = ({
  cleanupService,
}: CleanupJobDependencies) => {
  
  const start = () => {
    cron.schedule(CLEANUP_SCHEDULE, async () => {
      logger.info("[Cleanup] Cleanup job started");

      try {
        const result = await cleanupService.run();

        logger.info(
          result,
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

  return {
    start,
  };
};

export type CleanupJob = ReturnType<typeof createCleanupJob>;