import type { DatabaseClient } from "../../database/prisma/types.js";
import { env } from "../../config/env.js";
import { createPaystackProvider } from "./providers/paystack.provider.js";
import { createPaymentProviderRegistry } from "./providers/payment-provider.registry.js";
import { createPaymentRepository } from "./repositories/payment.repository.js";
import type { PrismaClient } from "@prisma/client";

type PaymentDependencies = {
  db: PrismaClient;
};

export const createPaymentDependencies = ({db}: PaymentDependencies) => {
 
  // Repository
  const paymentRepository = createPaymentRepository(db);

  // Providers
  const paystackProvider = createPaystackProvider({
    secretKey: env.payment.paystack.secretKey,
    baseUrl: env.payment.paystack.baseUrl,
  });

  
  // Provider Registry
  const paymentProviderRegistry =
    createPaymentProviderRegistry({
      paystack: paystackProvider,
    });

  return {
    paymentRepository,
    paymentProviderRegistry,
  };
};

export type PaymentDependenciesResult = ReturnType<
  typeof createPaymentDependencies
>;