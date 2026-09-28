import type { EventType } from "../../../shared/events/event.types.js";
import type { OutboxRepository } from "../repositories/outbox.repository.js";

const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 5_000;

type CreateOutboxServiceDependencies = {
  outboxRepository: OutboxRepository;
};

type CreateEventInput = {
  eventType: EventType;
  aggregateType: string;
  aggregateId: string;
  payload: object;
  repository?: OutboxRepository;
};

export const createOutboxService = ({
  outboxRepository,
}: CreateOutboxServiceDependencies) => {
  const createEvent = async ({
    eventType,
    aggregateType,
    aggregateId,
    payload,
    repository,
  }: CreateEventInput) => {
    const targetRepository = repository ?? outboxRepository;

    return targetRepository.create({
      eventType,
      aggregateType,
      aggregateId,
      payload,
    });
  };

  const getPendingEvents = async (limit = 50) => {
    return outboxRepository.findPendingEvents(limit, new Date());
  };

  const markProcessing = async (eventId: string) => {
    return outboxRepository.markProcessing(eventId);
  };

  const markPublished = async (eventId: string) => {
    return outboxRepository.markPublished(eventId, new Date());
  };

  const markFailed = async (eventId: string, error: unknown) => {
    const event = await outboxRepository.findById(eventId);

    if (!event) {
      throw new Error(`Outbox event not found: ${eventId}`);
    }

    const lastError =
      error instanceof Error ? error.message : "Unknown publishing error";

    if (event.attempts >= MAX_ATTEMPTS) {
      return outboxRepository.markDeadLetter(eventId, lastError);
    }

    const retryDelay = BASE_RETRY_DELAY_MS * 2 ** (event.attempts - 1);

    const availableAt = new Date(Date.now() + retryDelay);

    return outboxRepository.markFailed(
      eventId,
      availableAt,
      lastError,
    );
  };

  return {
    createEvent,
    getPendingEvents,
    markProcessing,
    markPublished,
    markFailed,
  };
};

export type OutboxService = ReturnType<typeof createOutboxService>;