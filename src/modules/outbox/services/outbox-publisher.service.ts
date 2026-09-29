import type { EventPublisher } from "../publishers/event-publisher.js";
import type { OutboxService } from "./outbox.service.js";

type CreateOutboxPublisherServiceDependencies = {
  outboxService: OutboxService;
  eventPublisher: EventPublisher;
};

type StoredEventPayload = {
  eventId: string;
};

export const createOutboxPublisherService = ({
  outboxService,
  eventPublisher,
}: CreateOutboxPublisherServiceDependencies) => {
  const publishPendingEvents = async (limit = 50) => {
    await outboxService.recoverStaleEvents();

    const events = await outboxService.claimPendingEvents(limit);

    let publishedCount = 0;
    let failedCount = 0;

    for (const event of events) {
      try {
        const payload = event.payload as StoredEventPayload;

        if (!payload.eventId) {
          throw new Error(
            `Outbox event payload is missing eventId: ${event.id}`,
          );
        }

        await eventPublisher.publish({
          eventId: payload.eventId,
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
