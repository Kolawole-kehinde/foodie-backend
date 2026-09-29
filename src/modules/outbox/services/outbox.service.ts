import type { OrderEvent } from "../../../shared/events/event.types.js";
import type { OutboxRepository } from "../repositories/outbox.repository.js";

const MAX_ATTEMPTS = 5;
const BASE_RETRY_DELAY_MS = 5_000;
const PROCESSING_LEASE_MS = 5 * 60 * 1_000;

type CreateOutboxServiceDependencies = {
  outboxRepository: OutboxRepository;
};

type CreateEventInput = {
  event: OrderEvent;
  repository?: OutboxRepository;
};

export const createOutboxService = ({
  outboxRepository,
}: CreateOutboxServiceDependencies) => {
  
  const createEvent = async ({ event, repository }: CreateEventInput) => {
    const targetRepository = repository ?? outboxRepository;

    return targetRepository.create({
      eventType: event.eventType,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      payload: event,
    });
  };

  const recoverStaleEvents = async () => {
    const processingBefore = new Date(Date.now() - PROCESSING_LEASE_MS);

    return outboxRepository.recoverStaleEvents(processingBefore);
  };

  const claimPendingEvents = async (limit = 50) => {
    return outboxRepository.claimPendingEvents(limit, new Date());
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

    return outboxRepository.markFailed(eventId, availableAt, lastError);
  };

  return {
    createEvent,
    recoverStaleEvents,
    claimPendingEvents,
    markPublished,
    markFailed,
  };
};

export type OutboxService = ReturnType<typeof createOutboxService>;
