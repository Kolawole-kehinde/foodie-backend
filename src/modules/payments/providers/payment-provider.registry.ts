import { PaymentProvider } from "@prisma/client";

import type { PaymentProviderClient } from "../interfaces/payment-provider.js";

type PaymentProviderRegistryDependencies = {
  paystack: PaymentProviderClient;
};

export const createPaymentProviderRegistry = ({
  paystack,
}: PaymentProviderRegistryDependencies) => {
  const providers: Record<PaymentProvider, PaymentProviderClient> = {
    [PaymentProvider.PAYSTACK]: paystack,

    // Flutterwave will be added here later.
    // [PaymentProvider.FLUTTERWAVE]: flutterwave,
  };

  const getProvider = (
    provider: PaymentProvider,
  ): PaymentProviderClient => {
    const paymentProvider = providers[provider];

    if (!paymentProvider) {
      throw new Error(
        `Payment provider is not configured: ${provider}`,
      );
    }

    return paymentProvider;
  };

  return {
    getProvider,
  };
};

export type PaymentProviderRegistry = ReturnType<
  typeof createPaymentProviderRegistry
>;