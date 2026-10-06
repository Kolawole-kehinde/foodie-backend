import { PaymentAttemptStatus, PaymentStatus } from "@prisma/client";

import type { PaymentProviderClient } from "../providers/payment-provider.js";
import { PaymentProviderError } from "../errors/payment-provider.error.js";
import type { PaymentRepository } from "../repositories/index.js";

type InitializePaymentAttemptInput = {
  paymentId: string;
  attemptId: string;
  amount: string;
  currency: string;
  customerEmail: string;
  callbackUrl?: string;
};

type InitializePaymentAttemptDependencies = {
  provider: PaymentProviderClient;
  paymentRepository: PaymentRepository;
};

export const createInitializePaymentAttemptHelper = ({
  provider,
  paymentRepository,
}: InitializePaymentAttemptDependencies) => {
  const initializePaymentAttempt = async ({
    paymentId,
    attemptId,
    amount,
    currency,
    customerEmail,
    callbackUrl,
  }: InitializePaymentAttemptInput) => {
    /*
     * Use the PaymentAttempt ID as the deterministic provider
     * reference.
     */
    const providerReference = attemptId;

    try {
      const result = await provider.initializePayment({
        paymentId,
        attemptId,
        reference: providerReference,
        amount,
        currency,
        customerEmail,
        callbackUrl,
      });

      /*
       * Persist the provider result before returning the response.
       *
       * This is important for idempotency:
       *
       * First request:
       * INITIATED -> PROCESSING
       *
       * Second request with the same idempotency key:
       * finds the existing PROCESSING attempt and returns it.
       */
      await paymentRepository.updatePaymentAttempt(attemptId, {
  providerReference: result.providerReference,
  providerStatus: result.providerStatus,
  status: PaymentAttemptStatus.PROCESSING,
});

await paymentRepository.updatePayment(paymentId, {
  status: PaymentStatus.PROCESSING,
});

      return {
        paymentId,
        attemptId,
        provider: result.provider,
        providerReference: result.providerReference,
        providerStatus: result.providerStatus,
        authorizationUrl: result.authorizationUrl,
        accessCode: result.accessCode,
        status: result.status,
      };
    } catch (error) {
      /*
       * The provider error is intentionally allowed to bubble
       * back to the Payment Service.
       */
      if (error instanceof PaymentProviderError) {
        throw error;
      }

      throw error;
    }
  };

  return {
    initializePaymentAttempt,
  };
};

export type InitializePaymentAttemptHelper = ReturnType<
  typeof createInitializePaymentAttemptHelper
>;
