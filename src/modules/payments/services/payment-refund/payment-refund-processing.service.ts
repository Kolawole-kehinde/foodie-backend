import { RefundStatus } from "@prisma/client";
import type { PaymentProviderRegistry } from "../../providers/payment-provider.registry.js";
import { canTransitionRefundStatus } from "../../policies/refund-status-transition.policy.js";
import { mapProviderRefundStatus } from "./payment-refund-status.service.js";

type PaymentProviderClient = ReturnType<
  PaymentProviderRegistry["get"]
>;

type ProcessRefundInput = {
  provider: PaymentProviderClient;
  paymentId: string;
  providerReference: string;
  amount: string;
  currency: string;
  reason?: string;
};

export const createPaymentRefundProcessingService = () => {
  const processRefund = async ({
    provider,
    paymentId,
    providerReference,
    amount,
    currency,
    reason,
  }: ProcessRefundInput) => {
    const result = await provider.refundPayment({
      paymentId,
      providerReference,
      amount,
      currency,
      reason,
    });

    if (result.amount !== amount) {
      throw new Error(
        "Provider refund amount does not match requested refund amount",
      );
    }

    if (
      result.currency.trim().toUpperCase() !==
      currency.trim().toUpperCase()
    ) {
      throw new Error(
        "Provider refund currency does not match payment currency",
      );
    }

    const finalStatus = mapProviderRefundStatus(result.status);

    if (
      finalStatus !== RefundStatus.PROCESSING &&
      !canTransitionRefundStatus(
        RefundStatus.PROCESSING,
        finalStatus,
      )
    ) {
      throw new Error(
        `Invalid refund status transition: ${RefundStatus.PROCESSING} -> ${finalStatus}`,
      );
    }

    return {
      result,
      finalStatus,
    };
  };

  return {
    processRefund,
  };
};

export type PaymentRefundProcessingService = ReturnType<
  typeof createPaymentRefundProcessingService
>;