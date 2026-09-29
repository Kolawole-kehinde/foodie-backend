import type { EventPublisher } from "../publishers/event-publisher.js";
import type { OutboxService } from "./outbox.service.js";

type CreateOutboxPublisherServiceDependencies = {
  outboxService: OutboxService;
  eventPublisher: EventPublisher;
};

export const createOutboxPublisherService = ({
  outboxService,
  eventPublisher,
}: CreateOutboxPublisherServiceDependencies) => {
    
  const publishPendingEvents = async (limit = 50) => {
    const events = await outboxService.getPendingEvents(limit);

    let publishedCount = 0;
    let failedCount = 0;

    for (const event of events) {
      try {
        await outboxService.markProcessing(event.id);

        await eventPublisher.publish({
          eventId: event.id,
          eventType: event.eventType,
          payload: event.payload,
        });

        await outboxService.markPublished(event.id);

        publishedCount++;
      } catch (error) {
        failedCount++;

        await outboxService.markFailed(event.id, error);
      }
    }

    return {
      processedCount: events.length,
      publishedCount,
      failedCount,
    };
  };

  return {
    publishPendingEvents,
  };
};

export type OutboxPublisherService = ReturnType<
  typeof createOutboxPublisherService
>;
