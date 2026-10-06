import type { DatabaseClient } from "../../database/prisma/types.js";
import { createOutboxRepository } from "./repositories/outbox.repository.js";
import { createOutboxService } from "./services/outbox.service.js";
import { createOutboxPublisherService } from "./services/outbox-publisher.service.js";
import { createInProcessEventPublisher } from "./publishers/in-process-event-publisher.js";
import { createEventBus } from "./publishers/event-bus.js";

export const createOutboxDependencies = (
  db: DatabaseClient,
) => {
  const outboxRepository = createOutboxRepository(db);

  const outboxService = createOutboxService({
    outboxRepository,
  });

  const eventBus = createEventBus();

  const eventPublisher = createInProcessEventPublisher(
    eventBus,
  );

  const outboxPublisherService =
    createOutboxPublisherService({
      outboxService,
      eventPublisher,
    });

  return {
    outboxRepository,
    outboxService,
    eventBus,
    eventPublisher,
    outboxPublisherService,
  };
};

export type OutboxContainer =
  ReturnType<typeof createOutboxDependencies>;