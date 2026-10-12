
import axios from "axios";

import { PaymentProviderError } from "../../errors/payment-provider.error.js";

type PaystackErrorResponse = {
  message?: unknown;
  code?: unknown;
};

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

  const statusCode = error.response?.status;
  const responseData = error.response?.data as
    | PaystackErrorResponse
    | undefined;

  const providerMessage =
    typeof responseData?.message === "string"
      ? responseData.message
      : "Paystack request failed";

  const providerCode =
    typeof responseData?.code === "string"
      ? responseData.code
      : undefined;

  const base = {
    provider: "PAYSTACK",
    statusCode,
    providerCode,
    cause: error,
  } as const;

  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") {
    return new PaymentProviderError({
      ...base,
      code: "TIMEOUT",
      message: "Paystack request timed out",
      retryable: true,
      uncertain: true,
    });
  }

  if (statusCode === 408) {
    return new PaymentProviderError({
      ...base,
      code: "TIMEOUT",
      message: providerMessage,
      retryable: true,
      uncertain: true,
    });
  }

  if (error.request && !error.response) {
    return new PaymentProviderError({
      ...base,
      code: "NETWORK_ERROR",
      message: "Unable to determine the outcome of the Paystack request",
      retryable: true,
      uncertain: true,
    });
  }

  if (statusCode === 400) {
    return new PaymentProviderError({
      ...base,
      code: "BAD_REQUEST",
      message: providerMessage,
      retryable: false,
      uncertain: false,
    });
  }

  if (statusCode === 401) {
    return new PaymentProviderError({
      ...base,
      code: "UNAUTHORIZED",
      message: providerMessage,
      retryable: false,
      uncertain: false,
    });
  }

  if (statusCode === 403) {
    return new PaymentProviderError({
      ...base,
      code: "FORBIDDEN",
      message: providerMessage,
      retryable: false,
      uncertain: false,
    });
  }

  if (statusCode === 404) {
    return new PaymentProviderError({
      ...base,
      code: "NOT_FOUND",
      message: providerMessage,
      retryable: false,
      uncertain: false,
    });
  }

  if (statusCode === 409) {
    return new PaymentProviderError({
      ...base,
      code: "CONFLICT",
      message: providerMessage,
      retryable: false,
      uncertain: false,
    });
  }

  if (statusCode === 429) {
    return new PaymentProviderError({
      ...base,
      code: "RATE_LIMITED",
      message: providerMessage,
      retryable: true,
      uncertain: false,
    });
  }

  if (statusCode !== undefined && statusCode >= 500) {
    return new PaymentProviderError({
      ...base,
      code: "SERVER_ERROR",
      message: providerMessage,
      retryable: true,
      uncertain: true,
    });
  }

  return new PaymentProviderError({
    ...base,
    code: "UNKNOWN",
    message: providerMessage,
    retryable: false,
    uncertain: true,
  });
};
