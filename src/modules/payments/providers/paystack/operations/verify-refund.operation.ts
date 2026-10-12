
import { PaymentProvider } from "@prisma/client";

import { PaymentProviderError } from "../../../errors/payment-provider.error.js";
import type {
  VerifyRefundInput,
  VerifyRefundResult,
} from "../../../types/payment.types.js";

import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";

import {
  fromSubunit,
  getRefundProviderReference,
  mapRefundStatus,
  normalizeProviderCurrency,
} from "../paystack-mappers.js";

import type { PaystackRefundResponse } from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type VerifyRefundOperationDependencies = {
  http: PaystackHttp;
};

export const createVerifyRefundOperation = ({
  http,
}: VerifyRefundOperationDependencies) => {
  const verifyRefund = async (
    input: VerifyRefundInput,
  ): Promise<VerifyRefundResult> => {
    const refundReference = encodeURIComponent(
      input.providerRefundReference,
    );

    const response = await http.request<PaystackRefundResponse>({
      method: "GET",
      url: `/refund/${refundReference}`,
    });

    const data = assertPaystackResponse(
      response.data,
      "refund verification",
    );

    if (
      !Number.isSafeInteger(data.id) ||
      data.id <= 0 ||
      !Number.isSafeInteger(data.amount) ||
      data.amount < 0 ||
      typeof data.currency !== "string" ||
      typeof data.status !== "string"
    ) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Paystack returned an invalid refund verification response",
        retryable: false,
        uncertain: true,
      });
    }

    const status = mapRefundStatus(data.status);
    const transactionReference = getRefundProviderReference(
      data.transaction,
    );

    const completedAt = data.refunded_at
      ? new Date(data.refunded_at)
      : undefined;

    return {
      provider: PaymentProvider.PAYSTACK,
      providerRefundReference: String(data.id),
      providerReference: transactionReference,
      amount: fromSubunit(data.amount),
      currency: normalizeProviderCurrency(data.currency),
      status,
      providerStatus: data.status,
      failureReason:
        status === "FAILED" ? (data.reason ?? undefined) : undefined,
      completedAt:
        completedAt && !Number.isNaN(completedAt.getTime())
          ? completedAt
          : undefined,
      metadata: {
        transactionReference,
      },
    };
  };

  return verifyRefund;
};
