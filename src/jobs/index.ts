import type { OrderService } from "../modules/order/services/order.service.js";

import { createCleanupContainer } from "./cleanup/cleanup.container.js";
import { createExpireOrdersJob } from "./orders/expire-orders.job.js";

type StartJobsDependencies = {
  orderService: OrderService;
};

export const startJobs = ({
  orderService,
}: StartJobsDependencies) => {
  const cleanup = createCleanupContainer();

  cleanup.cleanupJob.start();

  const expireOrdersJob = createExpireOrdersJob({
    orderService,
  });

  expireOrdersJob.start();
};