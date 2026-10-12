
import { PaymentProvider } from "@prisma/client";
import type { RefundPaymentInput, RefundPaymentResult,} from "../../../types/payment.types.js";
import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";
import { fromSubunit, getRefundProviderReference, mapRefundStatus, normalizeCurrency, toSubunit,} from "../paystack-mappers.js";

import type { PaystackRefundResponse } from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type RefundPaymentOperationDependencies = {
  http: PaystackHttp;
};

export const createRefundPaymentOperation = ({ http}: RefundPaymentOperationDependencies) => {

  const refundPayment = async (input: RefundPaymentInput): Promise<RefundPaymentResult> => {
    const amount = toSubunit(input.amount);
    const currency = normalizeCurrency(input.currency);

    const response = await http.request<PaystackRefundResponse>({
      method: "POST",
      url: "/refund",
      data: {
        transaction: input.providerReference,
        amount,
        currency,
        merchant_note: input.reason,
      },
    });

    const data = assertPaystackResponse(
      response.data,
      "payment refund",
    );

    const status = mapRefundStatus(data.status);

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: input.providerReference,
      providerRefundReference: String(data.id),
      amount: fromSubunit(data.amount),
      currency: normalizeCurrency(data.currency),
      status,
      providerStatus: data.status,
      failureReason:
        status === "FAILED" ? (data.reason ?? undefined) : undefined,
      metadata: {
        transactionReference: getRefundProviderReference(data.transaction),
      },
    };
  };

  return refundPayment;
};
