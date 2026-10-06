import type { DomainEvent, EventType } from "../../../shared/events/event.types.js";

type EventHandler<TEvent extends DomainEvent = DomainEvent> = (
  event: TEvent,
) => Promise<void>;

export const createEventBus = () => {
  const handlers = new Map<string, EventHandler[]>();

  const subscribe = <TEvent extends DomainEvent>(
    eventType: TEvent["eventType"],
    handler: EventHandler<TEvent>,
  ) => {
    const existingHandlers = handlers.get(eventType) ?? [];

    existingHandlers.push(handler as EventHandler);

    handlers.set(eventType, existingHandlers);
  };

  const publish = async (event: DomainEvent) => {
    const eventHandlers = handlers.get(event.eventType) ?? [];

    for (const handler of eventHandlers) {
      await handler(event);
    }
  };

  return {
    subscribe,
    publish,
  };
};

export type EventBus = ReturnType<typeof createEventBus>;