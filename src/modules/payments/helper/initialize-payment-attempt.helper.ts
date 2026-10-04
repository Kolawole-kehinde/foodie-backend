import type { PaymentProviderClient } from "../providers/payment-provider.js";
import { PaymentProviderError } from "../errors/payment-provider.error.js";

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
};

export const createInitializePaymentAttemptHelper = ({
  provider,
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
       *
       * The Service owns the business transaction and decides
       * whether the failure is definitive or uncertain.
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

export type InitializePaymentAttemptHelper =
  ReturnType<
    typeof createInitializePaymentAttemptHelper
  >;