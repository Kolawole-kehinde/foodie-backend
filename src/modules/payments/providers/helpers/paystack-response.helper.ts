import { PaymentProviderError } from "../../errors/payment-provider.error.js";

type PaystackBaseResponse = {
  status: boolean;
  message?: unknown;
};

export const assertPaystackResponse = <T>(
  response: PaystackBaseResponse & {
    data?: T;
  },
  operation: string,
): T => {
  if (!response.status) {
    const message =
      typeof response.message === "string"
        ? response.message
        : `Paystack ${operation} failed`;

    throw new PaymentProviderError({
      provider: "PAYSTACK",
      code: "UNKNOWN",
      message,
      retryable: false,
      uncertain: true,
    });
  }

  if (response.data === undefined || response.data === null) {
    throw new PaymentProviderError({
      provider: "PAYSTACK",
      code: "INVALID_RESPONSE",
      message: `Paystack returned an invalid response for ${operation}`,
      retryable: false,
      uncertain: true,
    });
  }

  return response.data;
};