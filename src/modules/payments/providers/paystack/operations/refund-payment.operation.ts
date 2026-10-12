
import { PaymentProvider } from "@prisma/client";
import type {
  RefundPaymentInput,
  RefundPaymentResult,
} from "../../../types/payment.types.js";
import { PaymentProviderError } from "../../../errors/payment-provider.error.js";
import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";
import {
  fromSubunit,
  getRefundProviderReference,
  mapRefundStatus,
  normalizeCurrency,
  normalizeProviderCurrency,
  toSubunit,
} from "../paystack-mappers.js";
import type { PaystackRefundResponse } from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type RefundPaymentOperationDependencies = {
  http: PaystackHttp;
};

export const createRefundPaymentOperation = ({
  http,
}: RefundPaymentOperationDependencies) => {
  const refundPayment = async (
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> => {
    const amount = toSubunit(input.amount);
    const currency = normalizeCurrency(input.currency);

    // Include a stable local ID so recovery can identify the exact refund.
    const correlationMarker = `refund-id:${input.refundId}`;
    const merchantNote = input.reason
      ? `${correlationMarker}; ${input.reason}`.slice(0, 255)
      : correlationMarker;

    const response = await http.request<PaystackRefundResponse>({
      method: "POST",
      url: "/refund",
      data: {
        transaction: input.providerReference,
        amount,
        currency,
        merchant_note: merchantNote,
      },
    });

    const data = assertPaystackResponse(response.data, "payment refund");

    if (
      !Number.isSafeInteger(data.id) ||
      data.id <= 0 ||
      !Number.isSafeInteger(data.amount) ||
      data.amount <= 0 ||
      typeof data.currency !== "string" ||
      typeof data.status !== "string"
    ) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Paystack returned an invalid refund response",
        retryable: false,
        uncertain: true,
      });
    }

    const status = mapRefundStatus(data.status);
    const providerReference = getRefundProviderReference(data.transaction);

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: input.providerReference,
      providerRefundReference: String(data.id),
      amount: fromSubunit(data.amount),
      currency: normalizeProviderCurrency(data.currency),
      status,
      providerStatus: data.status,
      failureReason:
        status === "FAILED" ? data.reason ?? undefined : undefined,
      metadata: { transactionReference: providerReference },
    };
  };

  return refundPayment;
};
