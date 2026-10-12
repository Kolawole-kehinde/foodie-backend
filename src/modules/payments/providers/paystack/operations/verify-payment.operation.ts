import { PaymentProvider } from "@prisma/client";
import type {VerifyPaymentInput,VerifyPaymentResult,} from "../../../types/payment.types.js";
import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";
import { fromSubunit, getStringMetadata, mapPaymentStatus, normalizeCurrency,} from "../paystack-mappers.js";

import type { PaystackVerifyResponse } from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type VerifyPaymentOperationDependencies = {
  http: PaystackHttp;
};

export const createVerifyPaymentOperation = ({
  http,
}: VerifyPaymentOperationDependencies) => {


  const verifyPayment = async ( input: VerifyPaymentInput): Promise<VerifyPaymentResult> => {
    
    const reference = encodeURIComponent(input.providerReference);

    const response = await http.request<PaystackVerifyResponse>({
      method: "GET",
      url: `/transaction/verify/${reference}`,
    });

    const data = assertPaystackResponse(response.data, "payment verification");

    const currency = normalizeCurrency(data.currency);

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: data.reference,
      amount: fromSubunit(data.amount),
      currency,
      status: mapPaymentStatus(data.status),
      providerStatus: data.status,
      paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
      failureReason:
        data.status.trim().toLowerCase() === "failed"
          ? (data.gateway_response ?? undefined)
          : undefined,
      metadata: getStringMetadata(data.metadata),
    };
  };

  return verifyPayment;
};
