import type { DomainEvent } from "../../../shared/events/event.types.js";
import type { EventBus } from "./event-bus.js";

import type {
  EventPublisher,
  PublishEventInput,
} from "./event-publisher.js";

const isDomainEvent = (payload: unknown): payload is DomainEvent => {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const event = payload as Record<string, unknown>;

  return (
    typeof event.eventId === "string" &&
    typeof event.eventType === "string" &&
    typeof event.occurredAt === "string" &&
    typeof event.aggregateType === "string" &&
    typeof event.aggregateId === "string" &&
    "data" in event
  );
};

export const createInProcessEventPublisher = (
  eventBus: EventBus,
): EventPublisher => {
  const publish = async ({
    eventId,
    eventType,
    payload,
  }: PublishEventInput) => {
    if (!isDomainEvent(payload)) {
      throw new Error(
        `Invalid domain event payload for ${eventType}: ${eventId}`,
      );
    }

    console.log("[EVENT PUBLISHED]", {
      eventId,
      eventType,
      payload,
    });

    await eventBus.publish(payload);
  };

  return {
    publish,
  };
};