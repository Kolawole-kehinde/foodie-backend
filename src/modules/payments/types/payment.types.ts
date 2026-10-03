import type { PaymentProvider, PrismaClient } from "@prisma/client";

import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";
import type { PaymentRepository } from "../repositories/payment.repository.js";
import type { PaymentProcessingService } from "../services/payment-processing.service.js";

export type InitializePaymentInput = {
  orderId: string;
  userId: string;
  provider: PaymentProvider;
  callbackUrl?: string;
};

export type PaymentServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
  paymentProcessingService: PaymentProcessingService;
};