import type { PaymentProviderClient } from "../providers/payment-provider.js";
import type { PaymentRepository } from "../repositories/index.js";


type VerifyPaymentAttemptInput = {
  paymentId: string;
  attemptId: string;
  providerReference: string;
};

type VerifyPaymentAttemptDependencies = {
  paymentRepository: PaymentRepository;
  provider: PaymentProviderClient;
};

export const createVerifyPaymentAttemptHelper = ({
  paymentRepository,
  provider,
}: VerifyPaymentAttemptDependencies) => {
  const verifyPaymentAttempt = async ({
    paymentId,
    attemptId,
    providerReference,
  }: VerifyPaymentAttemptInput) => {
    /*
     * Load the original attempt so we know the amount and
     * currency that were actually requested.
     */
    const attempt =
      await paymentRepository.getPaymentAttemptById(attemptId);

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    /*
     * Make sure the attempt belongs to this Payment.
     */
    if (attempt.paymentId !== paymentId) {
      throw new Error(
        "Payment attempt does not belong to this payment",
      );
    }

    /*
     * Ask the provider for the current transaction state.
     */
    const result = await provider.verifyPayment({
      providerReference,
    });

    /*
     * Store the provider information in the returned result.
     *
     * The Service will decide how/when to persist it.
     */
    if (result.status === "SUCCESS") {
      const expectedAmount =
        attempt.amount.toString();

      const providerAmount =
        result.amount;

      const expectedCurrency =
        attempt.currency.trim().toUpperCase();

      const providerCurrency =
        result.currency.trim().toUpperCase();

      /*
       * Never accept SUCCESS if amount differs.
       */
      if (expectedAmount !== providerAmount) {
        throw new Error(
          `Payment amount mismatch. Expected ${expectedAmount} but provider returned ${providerAmount}.`,
        );
      }

      /*
       * Never accept SUCCESS if currency differs.
       */
      if (expectedCurrency !== providerCurrency) {
        throw new Error(
          `Payment currency mismatch. Expected ${expectedCurrency} but provider returned ${providerCurrency}.`,
        );
      }
    }

    return {
      paymentId,
      attemptId,
      provider: result.provider,
      providerReference:
        result.providerReference,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      providerStatus:
        result.providerStatus,
      paidAt: result.paidAt,
      failureReason:
        result.failureReason,
      metadata: result.metadata,
    };
  };

  return {
    verifyPaymentAttempt,
  };
};

export type VerifyPaymentAttemptHelper =
  ReturnType<
    typeof createVerifyPaymentAttemptHelper
  >;