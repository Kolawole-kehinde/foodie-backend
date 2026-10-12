
import type {
  PaymentProviderStatus,
  PaymentResourceType,
} from "../../types/payment.types.js";

import { PaymentProviderError } from "../../errors/payment-provider.error.js";
import type { PaystackRefundTransaction } from "./paystack.types.js";

export type PaystackRefundStatus =
  | "SUCCESS"
  | "PROCESSING"
  | "FAILED"
  | "UNKNOWN";

const invalidInput = (message: string): PaymentProviderError =>
  new PaymentProviderError({
    provider: "PAYSTACK",
    code: "BAD_REQUEST",
    message,
    retryable: false,
    uncertain: false,
  });

const invalidProviderResponse = (
  message: string,
): PaymentProviderError =>
  new PaymentProviderError({
    provider: "PAYSTACK",
    code: "INVALID_RESPONSE",
    message,
    retryable: false,
    uncertain: true,
  });

/**
 * Converts a positive decimal amount into minor units.
 *
 * This implementation assumes the payment flow supports currencies
 * with two decimal places.
 */
export const toSubunit = (amount: string): number => {
  const normalized = amount.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw invalidInput("Invalid payment amount");
  }

  const [whole, fraction = ""] = normalized.split(".");
  const minorUnits = BigInt(`${whole}${fraction.padEnd(2, "0")}`);
  const value = Number(minorUnits);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw invalidInput(
      "Payment amount is outside the supported range",
    );
  }

  return value;
};

/**
 * Converts provider minor units into a decimal amount string.
 */
export const fromSubunit = (amount: number): string => {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw invalidProviderResponse(
      "Paystack returned an invalid amount",
    );
  }

  return (amount / 100).toFixed(2);
};

const validateCurrency = (
  currency: string,
): string | undefined => {
  const normalized = currency.trim().toUpperCase();

  return /^[A-Z]{3}$/.test(normalized)
    ? normalized
    : undefined;
};

/** Validates currency supplied by our application. */
export const normalizeCurrency = (currency: string): string => {
  const normalized = validateCurrency(currency);

  if (!normalized) {
    throw invalidInput("Invalid currency");
  }

  return normalized;
};

/** Validates currency received from Paystack. */
export const normalizeProviderCurrency = (
  currency: string,
): string => {
  const normalized = validateCurrency(currency);

  if (!normalized) {
    throw invalidProviderResponse(
      "Paystack returned an invalid currency",
    );
  }

  return normalized;
};

export const mapPaymentStatus = (
  status: string,
): PaymentProviderStatus => {
  switch (status.trim().toLowerCase()) {
    case "success":
      return "SUCCESS";
    case "failed":
      return "FAILED";
    case "abandoned":
      return "CANCELLED";
    case "pending":
    case "processing":
    case "ongoing":
    case "queued":
      return "PROCESSING";
    default:
      return "UNKNOWN";
  }
};

export const mapRefundStatus = (
  status: string,
): PaystackRefundStatus => {
  switch (status.trim().toLowerCase()) {
    case "processed":
      return "SUCCESS";
    case "pending":
    case "processing":
    case "needs-attention":
      return "PROCESSING";
    case "failed":
    case "reversed":
      return "FAILED";
    default:
      return "UNKNOWN";
  }
};

export const getResourceType = (
  eventType: string,
): PaymentResourceType => {
  const normalized = eventType.trim().toLowerCase();

  if (normalized.startsWith("refund.")) {
    return "REFUND";
  }

  if (
    normalized.startsWith("charge.") ||
    normalized.startsWith("transaction.")
  ) {
    return "PAYMENT";
  }

  return "UNKNOWN";
};

export const getStringMetadata = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

export const getRefundProviderReference = (
  transaction: PaystackRefundTransaction,
): string | undefined => {
  if (typeof transaction === "string") {
    return transaction.length > 0 ? transaction : undefined;
  }

  if (typeof transaction === "number") {
    return Number.isSafeInteger(transaction) && transaction > 0
      ? String(transaction)
      : undefined;
  }

  if (typeof transaction === "object" && transaction !== null) {
    if (
      typeof transaction.reference === "string" &&
      transaction.reference.length > 0
    ) {
      return transaction.reference;
    }

    if (
      typeof transaction.id === "number" &&
      Number.isSafeInteger(transaction.id) &&
      transaction.id > 0
    ) {
      return String(transaction.id);
    }
  }

  return undefined;
};