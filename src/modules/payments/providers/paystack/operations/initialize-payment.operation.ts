
import { PaymentProvider } from "@prisma/client";
import type { InitializePaymentInput, InitializePaymentResult,} from "../../../types/payment.types.js";
import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";
import {normalizeCurrency,toSubunit,} from "../paystack-mappers.js";



import type { PaystackInitializeResponse } from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type InitializePaymentOperationDependencies = {
  http: PaystackHttp;
};


export const createInitializePaymentOperation = ({
  http,
}: InitializePaymentOperationDependencies) => {

  const initializePayment = async ( input: InitializePaymentInput): Promise<InitializePaymentResult> => {
    const amount = toSubunit(input.amount);
    const currency = normalizeCurrency(input.currency);

    const metadata = {
      ...(input.metadata ?? {}),
      paymentId: input.paymentId,
      attemptId: input.attemptId,
    };

    const response = await http.request<PaystackInitializeResponse>({
      method: "POST",
      url: "/transaction/initialize",
      data: {
        amount,
        currency,
        email: input.customerEmail,
        callback_url: input.callbackUrl,
        reference: input.reference,
        metadata,
      },
    });

    const data = assertPaystackResponse(
      response.data,
      "payment initialization",
    );

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: data.reference,
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      status: "PROCESSING",
      providerStatus: "initialized",
      metadata,
    };
  };

  return initializePayment;
};