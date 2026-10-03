import type { PrismaClient } from "@prisma/client";
import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";
import type { PaymentRepository } from "../repositories/payment.repository.js";

export type InitializePaymentInput = {
  orderId: string;
  userId: string;
  amount: string;
  currency: string;
  customerEmail: string;
  callbackUrl?: string;
  provider: Parameters<PaymentProviderRegistry["getProvider"]>[0];
};

export type PaymentServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
};
