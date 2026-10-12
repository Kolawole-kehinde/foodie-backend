
import { PaymentProvider } from "@prisma/client";
import type { VerifyRefundInput, VerifyRefundResult,} from "../../../types/payment.types.js";
import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";
import {fromSubunit,getRefundProviderReference,mapRefundStatus,normalizeCurrency,} from "../paystack-mappers.js";

import type { PaystackRefundResponse } from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type VerifyRefundOperationDependencies = {
  http: PaystackHttp;
};

export const createVerifyRefundOperation = ({ http}: VerifyRefundOperationDependencies) => {

  const verifyRefund = async ( input: VerifyRefundInput): Promise<VerifyRefundResult> => {
    
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

    const status = mapRefundStatus(data.status);

    return {
      provider: PaymentProvider.PAYSTACK,
      providerRefundReference: String(data.id),
      amount: fromSubunit(data.amount),
      currency: normalizeCurrency(data.currency),
      status,
      providerStatus: data.status,
      failureReason:
        status === "FAILED" ? (data.reason ?? undefined) : undefined,
      completedAt: data.refunded_at
        ? new Date(data.refunded_at)
        : undefined,
      metadata: {
        transactionReference: getRefundProviderReference(
          data.transaction,
        ),
      },
    };
  };

  return verifyRefund;
};
