export type PublishEventInput = {
  eventId: string;
  eventType: string;
  payload: unknown;
};

export type EventPublisher = {
  publish: (event: PublishEventInput) => Promise<void>;
};