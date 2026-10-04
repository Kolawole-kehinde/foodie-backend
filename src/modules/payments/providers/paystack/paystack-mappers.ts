

import type { PaymentProviderStatus, PaymentResourceType } from "../../types/payment.types.js";
import type { PaystackRefundTransaction } from "./paystack.types.js";


  export const toSubunit = (amount: string): number => {
  const normalized = amount.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Invalid payment amount");
  }

  const [whole, fraction = ""] = normalized.split(".");

  const minorUnits = BigInt(
    `${whole}${fraction.padEnd(2, "0")}`,
  );

  const value = Number(minorUnits);

  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Payment amount is outside the supported range");
  }

  return value;
};

export const fromSubunit = (amount: number): string => {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new Error("Invalid Paystack amount");
  }

  return (amount / 100).toFixed(2);
};

export const normalizeCurrency = (currency: string): string => {
  const normalized = currency.trim().toUpperCase();

  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new Error("Invalid currency");
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

export const getResourceType = (
  eventType: string,
): PaymentResourceType => {
  const normalized = eventType.toLowerCase();

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
    return transaction;
  }

  if (typeof transaction === "number") {
    return String(transaction);
  }

  if (typeof transaction === "object" && transaction !== null) {
    if (typeof transaction.reference === "string") {
      return transaction.reference;
    }

    if (typeof transaction.id === "number") {
      return String(transaction.id);
    }
  }

  return undefined;
};