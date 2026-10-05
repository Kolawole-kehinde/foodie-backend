import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";

import { env } from "../../config/env.js";

import { createPaystackProvider } from "./providers/paystack/paystack.provider.js";
import { createPaymentProviderRegistry } from "./providers/payment-provider.registry.js";

import { createPaymentRepository } from "./repositories/index.js";

import { createPaymentEventFactory } from "./events/payment-event.factory.js";

import { createPaymentProcessingService } from "./services/payment-processing.service.js";
import { createPaymentService } from "./services/payment.service.js";
import { createPaymentWebhookService } from "./services/payment-webhook.service.js";
import { createPaymentReconciliationService } from "./services/payment-reconciliation.service.js";
import { createPaymentQueryService } from "./services/payment-query.service.js";
import { createPaymentRefundService } from "./services/payment-refund.service.js";
import { createPaymentRefundQueryService } from "./services/payment-refund-query.service.js";

import { createPaymentController } from "./controllers/payment.controller.js";
import { createPaymentQueryController } from "./controllers/payment-query.controller.js";
import { createPaymentReconciliationController } from "./controllers/payment-reconciliation.controller.js";
import { createPaymentRefundController } from "./controllers/payment-refund.controller.js";
import { createPaymentRefundQueryController } from "./controllers/payment-refund-query.controller.js";

import { createPaymentRoutes } from "./routes/payment.routes.js";

import type { OutboxService } from "../outbox/services/outbox.service.js";

type PaymentDependencies = {
  db: PrismaClient;
  authenticate: RequestHandler;
  outboxService: OutboxService;
};

export const createPaymentDependencies = ({
  db,
  authenticate,
  outboxService,
}: PaymentDependencies) => {
  // Repository
  const paymentRepository =
    createPaymentRepository(db);

  // Providers
  const paystackProvider =
    createPaystackProvider({
      secretKey:
        env.payment.paystack.secretKey,
      baseUrl:
        env.payment.paystack.baseUrl,
    });

  // Provider Registry
  const paymentProviderRegistry =
    createPaymentProviderRegistry({
      PAYSTACK: paystackProvider,
    });

  // Payment Event Factory
  const paymentEventFactory =
    createPaymentEventFactory();

  // Processing Service
  const paymentProcessingService =
    createPaymentProcessingService({
      db,
    });

  // Payment Service
  const paymentService =
    createPaymentService({
      db,
      paymentRepository,
      paymentProviderRegistry,
      paymentProcessingService,
    });

  // Webhook Service
  const paymentWebhookService =
    createPaymentWebhookService({
      db,
      paymentRepository,
      paymentProviderRegistry,
      outboxService,
      paymentEventFactory,
    });

  // Reconciliation Service
 const paymentReconciliationService =
  createPaymentReconciliationService({
    db,
    paymentRepository,
    paymentProviderRegistry,
    outboxService,
    paymentEventFactory,
  });
  // Query Service
  const paymentQueryService =
    createPaymentQueryService({
      paymentRepository,
    });

  // Refund Service
 const paymentRefundService =
  createPaymentRefundService({
    db,
    paymentRepository,
    paymentProviderRegistry,
    outboxService,
    paymentEventFactory,
  });

  // Refund Query Service
  const paymentRefundQueryService =
    createPaymentRefundQueryService({
      paymentRepository,
    });

  // Controllers
  const paymentController =
    createPaymentController({
      paymentService,
      paymentWebhookService,
    });

  const paymentQueryController =
    createPaymentQueryController({
      paymentQueryService,
    });

  const paymentReconciliationController =
    createPaymentReconciliationController({
      paymentReconciliationService,
    });

  const paymentRefundController =
    createPaymentRefundController({
      paymentRefundService,
    });

  const paymentRefundQueryController =
    createPaymentRefundQueryController({
      paymentRefundQueryService,
    });

  // Routes
  const paymentRoutes =
    createPaymentRoutes({
      paymentController,
      paymentQueryController,
      paymentReconciliationController,
      paymentRefundController,
      paymentRefundQueryController,
      authenticate,
    });

  return {
    paymentRepository,

    paystackProvider,
    paymentProviderRegistry,

    paymentEventFactory,

    paymentProcessingService,
    paymentService,
    paymentWebhookService,
    paymentReconciliationService,
    paymentQueryService,
    paymentRefundService,
    paymentRefundQueryService,

    paymentController,
    paymentQueryController,
    paymentReconciliationController,
    paymentRefundController,
    paymentRefundQueryController,

    paymentRoutes,
  };
};

export type PaymentDependenciesResult =
  ReturnType<typeof createPaymentDependencies>;