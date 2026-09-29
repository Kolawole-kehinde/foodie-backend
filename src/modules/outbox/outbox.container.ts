import type { DatabaseClient } from "../../database/prisma/types.js";
import { createOutboxRepository } from "./repositories/outbox.repository.js";
import { createOutboxService } from "./services/outbox.service.js";
import { createOutboxPublisherService } from "./services/outbox-publisher.service.js";
import { createLoggingEventPublisher } from "./publishers/logging-event.publisher.js";

export const createOutboxDependencies = (
  db: DatabaseClient,
) => {
  const outboxRepository = createOutboxRepository(db);

  const outboxService = createOutboxService({
    outboxRepository,
  });

  const eventPublisher = createLoggingEventPublisher();

  const outboxPublisherService =
    createOutboxPublisherService({
      outboxService,
      eventPublisher,
    });

  return {
    outboxRepository,
    outboxService,
    eventPublisher,
    outboxPublisherService,
  };
};

export type OutboxContainer =
  ReturnType<typeof createOutboxDependencies>;