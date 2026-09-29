import type { OutboxPublisherService } from "../modules/outbox/services/outbox-publisher.service.js";

type CreateOutboxPublisherJobDependencies = {
  outboxPublisherService: OutboxPublisherService;
};

export const createOutboxPublisherJob = ({
  outboxPublisherService,
}: CreateOutboxPublisherJobDependencies) => {
  let running = false;

  const run = async () => {
    if (running) {
      return;
    }

    running = true;

    try {
      const result =
        await outboxPublisherService.publishPendingEvents();

      if (result.processedCount > 0) {
        console.log("[OUTBOX PUBLISHER]", result);
      }
    } catch (error) {
      console.error(
        "[OUTBOX PUBLISHER] Job failed",
        error,
      );
    } finally {
      running = false;
    }
  };

  const start = () => {
    const interval = setInterval(run, 5_000);

    void run();

    return () => {
      clearInterval(interval);
    };
  };

  return {
    run,
    start,
  };
};

export type OutboxPublisherJob =
  ReturnType<typeof createOutboxPublisherJob>;