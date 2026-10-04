import axios from "axios";

import { PaymentProviderError } from "../../errors/payment-provider.error.js";

export const normalizePaystackError = (
  error: unknown,
): PaymentProviderError => {
  if (!axios.isAxiosError(error)) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "UNKNOWN",
      message: "Unexpected Paystack provider error",
      retryable: false,
      uncertain: true,
      cause: error,
    });
  }

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "TIMEOUT",
      message: "Paystack request timed out",
      retryable: true,
      uncertain: true,
      cause: error,
    });
  }

  if (error.request && !error.response) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "NETWORK_ERROR",
      message: "Unable to communicate with Paystack",
      retryable: true,
      uncertain: true,
      cause: error,
    });
  }

  if (!error.response) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "UNKNOWN",
      message: "Unexpected Paystack provider error",
      retryable: false,
      uncertain: true,
      cause: error,
    });
  }

  const statusCode = error.response.status;

  const responseData = error.response.data as
    | {
        message?: unknown;
        code?: unknown;
      }
    | undefined;

  const providerMessage =
    typeof responseData?.message === "string"
      ? responseData.message
      : "Paystack request failed";

  const providerCode =
    typeof responseData?.code === "string"
      ? responseData.code
      : undefined;

  if (statusCode === 400) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "BAD_REQUEST",
      message: providerMessage,
      retryable: false,
      uncertain: false,
      statusCode,
      providerCode,
      cause: error,
    });
  }

  if (statusCode === 401) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "UNAUTHORIZED",
      message: providerMessage,
      retryable: false,
      uncertain: false,
      statusCode,
      providerCode,
      cause: error,
    });
  }

  if (statusCode === 403) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "FORBIDDEN",
      message: providerMessage,
      retryable: false,
      uncertain: false,
      statusCode,
      providerCode,
      cause: error,
    });
  }

  if (statusCode === 404) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "NOT_FOUND",
      message: providerMessage,
      retryable: false,
      uncertain: false,
      statusCode,
      providerCode,
      cause: error,
    });
  }

  if (statusCode === 409) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "CONFLICT",
      message: providerMessage,
      retryable: false,
      uncertain: false,
      statusCode,
      providerCode,
      cause: error,
    });
  }

  if (statusCode === 429) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "RATE_LIMITED",
      message: providerMessage,
      retryable: true,
      uncertain: true,
      statusCode,
      providerCode,
      cause: error,
    });
  }

  if (statusCode >= 500) {
    return new PaymentProviderError({
      provider: "PAYSTACK",
      code: "SERVER_ERROR",
      message: providerMessage,
      retryable: true,
      uncertain: true,
      statusCode,
      providerCode,
      cause: error,
    });
  }

  return new PaymentProviderError({
    provider: "PAYSTACK",
    code: "UNKNOWN",
    message: providerMessage,
    retryable: false,
    uncertain: true,
    statusCode,
    providerCode,
    cause: error,
  });
};