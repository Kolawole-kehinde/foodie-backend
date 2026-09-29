import type { EventPublisher, PublishEventInput } from "./event-publisher.js";

export const createLoggingEventPublisher = (): EventPublisher => {
  const publish = async ({
    eventId,
    eventType,
    payload,
  }: PublishEventInput) => {
    console.log("[EVENT PUBLISHED]", {
      eventId,
      eventType,
      payload,
    });
  };

  return {
    publish,
  };
};
