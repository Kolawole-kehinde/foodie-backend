
import { logger } from "../../../config/logger.js";
import type { NotificationDeliveryWorker } from "./notification-delivery.worker.js";

type NotificationDeliveryRunnerDependencies = {
  worker: NotificationDeliveryWorker;
  pollIntervalMs?: number;
  batchSize?: number;
};

export const createNotificationDeliveryRunner = ({
  worker,
  pollIntervalMs = 5_000,
  batchSize = 20,
}: NotificationDeliveryRunnerDependencies) => {
  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1) {
    throw new Error("pollIntervalMs must be a positive integer");
  }

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize must be a positive integer");
  }

  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let activeCycle: Promise<void> | undefined;

  const scheduleNextCycle = () => {
    if (!started) return;

    timer = setTimeout(() => {
      void runCycle();
    }, pollIntervalMs);
  };

  const runCycle = async (): Promise<void> => {
    if (!started || activeCycle) return;

    const cycle = (async () => {
      try {
        const result = await worker.processPendingDeliveries(batchSize);

        if (result.fetched > 0) {
          logger.info(
            { ...result },
            "Notification delivery batch completed",
          );
        }

        const deadLetterResult =
          await worker.processDeadLetters(batchSize);

        if (deadLetterResult.deadLettered > 0) {
          logger.warn(
            { ...deadLetterResult },
            "Notification deliveries moved to dead-letter queue",
          );
        }
      } catch (error) {
        logger.error(
          { err: error },
          "Notification delivery worker cycle failed",
        );
      }
    })();

    activeCycle = cycle;

    try {
      await cycle;
    } finally {
      if (activeCycle === cycle) {
        activeCycle = undefined;
      }

      scheduleNextCycle();
    }
  };

  const start = () => {
    if (started) {
      logger.warn("Notification delivery runner is already running");
      return;
    }

    started = true;

    logger.info(
      { pollIntervalMs, batchSize },
      "Notification delivery runner started",
    );

    // Pick up queued emails immediately on startup.
    void runCycle();
  };

  const stop = async () => {
    if (!started) return;

    started = false;

    if (timer) {
      clearTimeout(timer);
      timer = undefined;
    }

    // Wait for any active batch to finish before closing database connections.
    if (activeCycle) {
      await activeCycle;
    }

    logger.info("Notification delivery runner stopped");
  };

  return { start, stop };
};

export type NotificationDeliveryRunner = ReturnType<
  typeof createNotificationDeliveryRunner
>;