
import { PaymentProvider } from "@prisma/client";

import { PaymentProviderError } from "../../../errors/payment-provider.error.js";
import type {
  VerifyPaymentInput,
  VerifyPaymentResult,
} from "../../../types/payment.types.js";

import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";

import {
  fromSubunit,
  getStringMetadata,
  mapPaymentStatus,
  normalizeProviderCurrency,
} from "../paystack-mappers.js";

import type { PaystackVerifyResponse } from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type VerifyPaymentOperationDependencies = {
  http: PaystackHttp;
};

export const createVerifyPaymentOperation = ({
  http,
}: VerifyPaymentOperationDependencies) => {
  const verifyPayment = async (
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> => {
    const reference = encodeURIComponent(input.providerReference);

    const response = await http.request<PaystackVerifyResponse>({
      method: "GET",
      url: `/transaction/verify/${reference}`,
    });

    const data = assertPaystackResponse(
      response.data,
      "payment verification",
    );

    if (
      !Number.isSafeInteger(data.id) ||
      data.id <= 0 ||
      typeof data.reference !== "string" ||
      data.reference.length === 0 ||
      !Number.isSafeInteger(data.amount) ||
      data.amount < 0 ||
      typeof data.currency !== "string" ||
      typeof data.status !== "string"
    ) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Paystack returned an invalid payment verification response",
        retryable: false,
        uncertain: true,
      });
    }

    const currency = normalizeProviderCurrency(data.currency);
    const status = mapPaymentStatus(data.status);

    const paidAt = data.paid_at
      ? new Date(data.paid_at)
      : undefined;

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: data.reference,
      amount: fromSubunit(data.amount),
      currency,
      status,
      providerStatus: data.status,
      paidAt:
        paidAt && !Number.isNaN(paidAt.getTime())
          ? paidAt
          : undefined,
      failureReason:
        data.status.trim().toLowerCase() === "failed"
          ? (data.gateway_response ?? undefined)
          : undefined,
      metadata: getStringMetadata(data.metadata),
    };
  };

  return verifyPayment;
};
