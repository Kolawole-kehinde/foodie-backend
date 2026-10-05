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
        console.log(
          "[Outbox] Publisher job completed",
          result,
        );
      }
    } catch (error) {
      console.error(
        "[Outbox] Publisher job failed",
        error,
      );
    } finally {
      running = false;
    }
  };

  const start = () => {
    console.log(
      "[Outbox] Publisher job started",
      {
        interval: "5 seconds",
      },
    );

    const interval = setInterval(() => {
      void run();
    }, 5_000);

    void run();

    return () => {
      clearInterval(interval);

      console.log(
        "[Outbox] Publisher job stopped",
      );
    };
  };

  return {
    run,
    start,
  };
};

export type OutboxPublisherJob =
  ReturnType<typeof createOutboxPublisherJob>;