
import { PaymentProvider } from "@prisma/client";
import { PaymentProviderError } from "../../../errors/payment-provider.error.js";
import type { ListRefundsResult } from "../../../types/payment.types.js";
import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";
import {
  fromSubunit,
  getRefundProviderReference,
  mapRefundStatus,
  normalizeProviderCurrency,
} from "../paystack-mappers.js";
import type {
  PaystackRefundListResponse,
  PaystackVerifyResponse,
} from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type ListRefundsOperationDependencies = {
  http: PaystackHttp;
};

export const createListRefundsOperation = ({
  http,
}: ListRefundsOperationDependencies) => {
  const listRefunds = async (
    transactionReference: string,
  ): Promise<ListRefundsResult> => {
    const transactionResponse = await http.request<PaystackVerifyResponse>({
      method: "GET",
      url: `/transaction/verify/${encodeURIComponent(transactionReference)}`,
    });

    const transactionData = assertPaystackResponse(
      transactionResponse.data,
      "transaction verification",
    );

    const transactionId = transactionData.id;

    if (!Number.isSafeInteger(transactionId) || transactionId <= 0) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Paystack transaction ID is missing or invalid",
        retryable: false,
        uncertain: true,
      });
    }

    const response = await http.request<PaystackRefundListResponse>({
      method: "GET",
      url: "/refund",
      params: { transaction: transactionId },
    });

    const data = assertPaystackResponse(response.data, "refund listing");

    if (!Array.isArray(data)) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Paystack returned an invalid refund list",
        retryable: false,
        uncertain: true,
      });
    }

    return {
      provider: PaymentProvider.PAYSTACK,
      refunds: data.map((refund) => {
        if (
          !Number.isSafeInteger(refund.id) ||
          refund.id <= 0 ||
          !Number.isSafeInteger(refund.amount) ||
          refund.amount < 0 ||
          typeof refund.currency !== "string" ||
          typeof refund.status !== "string"
        ) {
          throw new PaymentProviderError({
            provider: "PAYSTACK",
            code: "INVALID_RESPONSE",
            message: "Paystack returned an invalid refund record",
            retryable: false,
            uncertain: true,
          });
        }

        const refundTransactionReference = getRefundProviderReference(
          refund.transaction,
        );

        const status = mapRefundStatus(refund.status);
        const completedAt = refund.refunded_at
          ? new Date(refund.refunded_at)
          : undefined;

        return {
          provider: PaymentProvider.PAYSTACK,
          providerRefundReference: String(refund.id),
          providerReference: refundTransactionReference,
          amount: fromSubunit(refund.amount),
          currency: normalizeProviderCurrency(refund.currency),
          status,
          providerStatus: refund.status,
          merchantNote: refund.merchant_note ?? undefined,
          failureReason:
            status === "FAILED" ? refund.reason ?? undefined : undefined,
          completedAt:
            completedAt && !Number.isNaN(completedAt.getTime())
              ? completedAt
              : undefined,
          metadata: {
            transactionReference: refundTransactionReference,
            transactionId,
          },
        };
      }),
    };
  };

  return listRefunds;
};
