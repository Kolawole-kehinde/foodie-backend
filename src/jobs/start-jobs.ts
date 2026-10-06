import type { OrderService } from "../modules/order/services/order.service.js";

import type { OutboxPublisherService } from "../modules/outbox/services/outbox-publisher.service.js";

import type { PaymentRepository } from "../modules/payments/repositories/payment.repository.js";

import type { PaymentRefundRepository } from "../modules/payments/repositories/payment-refund.repository.js";

import type { PaymentReconciliationService } from "../modules/payments/services/payment-reconciliation.service.js";

import type { PaymentRefundService } from "../modules/payments/services/payment-refund/payment-refund.service.js";

import { createCleanupContainer } from "./cleanup/cleanup.container.js";

import { createExpireOrdersJob } from "./orders/expire-orders.job.js";

import { createPaymentReconciliationJob } from "./payments/payment-reconciliation.job.js";

import { createRefundReconciliationJob } from "./payments/refund-reconciliation.job.js";

import { createOutboxPublisherJob } from "./outbox-publisher.job.js";

type StartJobsDependencies = {
  orderService: OrderService;

  outboxPublisherService: OutboxPublisherService;

  paymentRepository: PaymentRepository;

  paymentRefundRepository: PaymentRefundRepository;

  paymentReconciliationService: PaymentReconciliationService;

  paymentRefundService: PaymentRefundService;
};

export const startJobs = ({
  orderService,
  outboxPublisherService,
  paymentRepository,
  paymentRefundRepository,
  paymentReconciliationService,
  paymentRefundService,
}: StartJobsDependencies) => {
  const cleanup = createCleanupContainer();

  cleanup.cleanupJob.start();

  const expireOrdersJob = createExpireOrdersJob({
    orderService,
  });

  const outboxPublisherJob = createOutboxPublisherJob({
    outboxPublisherService,
  });

  const paymentReconciliationJob = createPaymentReconciliationJob({
    paymentRepository,
    paymentReconciliationService,
  });

  const refundReconciliationJob = createRefundReconciliationJob({
    paymentRefundRepository,
    paymentRefundService,
  });

  expireOrdersJob.start();

  outboxPublisherJob.start();

  paymentReconciliationJob.start();

  refundReconciliationJob.start();
};