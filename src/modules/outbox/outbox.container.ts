import type { DatabaseClient } from "../../database/prisma/types.js";

import { createOutboxRepository } from "./repositories/outbox.repository.js";
import { createOutboxService } from "./services/outbox.service.js";

export const createOutboxDependencies = (db: DatabaseClient) => {
  const outboxRepository = createOutboxRepository(db);

  const outboxService = createOutboxService({
    outboxRepository,
  });

  return {
    outboxRepository,
    outboxService,
  };
};

export type OutboxContainer = ReturnType<typeof createOutboxDependencies>;