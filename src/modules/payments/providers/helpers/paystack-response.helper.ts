
import { PaymentProviderError } from "../../errors/payment-provider.error.js";

type PaystackBaseResponse = {
  status: boolean;
  message?: unknown;
};

export const assertPaystackResponse = <T>(
  response: PaystackBaseResponse & {
    data?: T | null;
  },
  operation: string,
): T => {
  if (
    typeof response !== "object" ||
    response === null ||
    typeof response.status !== "boolean"
  ) {
    throw new PaymentProviderError({
      provider: "PAYSTACK",
      code: "INVALID_RESPONSE",
      message: `Paystack returned an invalid response for ${operation}`,
      retryable: false,
      uncertain: true,
    });
  }

  if (response.status === false) {
    throw new PaymentProviderError({
      provider: "PAYSTACK",
      code: "UNKNOWN",
      message:
        typeof response.message === "string"
          ? response.message
          : `Paystack ${operation} failed`,
      retryable: false,
      uncertain: false,
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
