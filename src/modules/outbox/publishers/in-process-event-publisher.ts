
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import type { EventBus } from "./event-bus.js";
import type {
  EventPublisher,
  PublishEventInput,
} from "./event-publisher.js";

export const createInProcessEventPublisher = (
  eventBus: EventBus,
): EventPublisher => {
  const publish = async ({
    eventId,
    eventType,
    payload,
  }: PublishEventInput) => {
    const result = domainEventSchema.safeParse(payload);

    if (!result.success) {
      throw new Error(
        `Invalid domain event payload for ${eventType}: ${eventId}. ${result.error.message}`,
      );
    }

    const event = result.data;

    if (
      event.eventId !== eventId ||
      event.eventType !== eventType
    ) {
      throw new Error(
        `Event metadata mismatch for event: ${eventId}`,
      );
    }

    console.log("[EVENT PUBLISHED]", {
      eventId,
      eventType,
      payload: event,
    });

    await eventBus.publish(event);
  };

  return {
    publish,
  };
};