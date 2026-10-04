import type { PaymentProvider } from "@prisma/client";
import type { PaymentProviderClient } from "./payment-provider.js";

type PaymentProviderRegistryDependencies = {
  [PaymentProvider.PAYSTACK]: PaymentProviderClient;
};

export const createPaymentProviderRegistry = (
  providers: PaymentProviderRegistryDependencies,
) => {
  return {
    get(provider: PaymentProvider): PaymentProviderClient {
      const paymentProvider = providers[provider];

      if (!paymentProvider) {
        throw new Error(
          `Payment provider ${provider} is not configured`,
        );
      }

      return paymentProvider;
    },
  };
};

export type PaymentProviderRegistry = ReturnType<
  typeof createPaymentProviderRegistry
>;