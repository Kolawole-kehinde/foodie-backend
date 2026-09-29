import type { OrderService } from "../modules/order/services/order.service.js";
import type { OutboxPublisherService } from "../modules/outbox/services/outbox-publisher.service.js";

import { createCleanupContainer } from "./cleanup/cleanup.container.js";
import { createExpireOrdersJob } from "./orders/expire-orders.job.js";
import { createOutboxPublisherJob } from "./outbox-publisher.job.js";


type StartJobsDependencies = {
  orderService: OrderService;
  outboxPublisherService: OutboxPublisherService;
};

export const startJobs = ({
  orderService,
  outboxPublisherService,
}: StartJobsDependencies) => {
  const cleanup = createCleanupContainer();

  cleanup.cleanupJob.start();

  const expireOrdersJob = createExpireOrdersJob({
    orderService,
  });

  const outboxPublisherJob = createOutboxPublisherJob({
    outboxPublisherService,
  });

  expireOrdersJob.start();
  outboxPublisherJob.start();
};