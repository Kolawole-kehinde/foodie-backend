// Its responsibility is simply:
// Communicate with Paystack and translate Paystack's API
// into our provider-independent contract.

import crypto from "node:crypto";
import { PaymentProvider } from "@prisma/client";

import type {
  InitializePaymentInput,
  InitializePaymentResult,
  PaymentProviderClient,
  ProviderPaymentStatus,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "./payment-provider.js";
import { createAxiosClient } from "../../../infrastructure/axios/axios.client.js";

type PaystackProviderDependencies = {
  secretKey: string;
  baseUrl: string;
};

// Small helper for converting our application amount into
// Paystack's expected subunit amount.
//
// Example:
// NGN 5,000.00 -> 500000 kobo
//
// We keep this conversion inside the adapter because
// Paystack-specific amount representation should not leak
// into the rest of the payment module.
const toSubunit = (amount: string): number => {
  const value = Number(amount);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Invalid payment amount");
  }

  return Math.round(value * 100);
};

// Convert Paystack's transaction status into our
// provider-independent payment status.
const mapPaymentStatus = (status: string): ProviderPaymentStatus => {
  switch (status.toLowerCase()) {
    case "success":
      return "SUCCESS";

    case "failed":
    case "reversed":
      return "FAILED";

    case "abandoned":
      return "CANCELLED";

    case "pending":
    case "processing":
    case "ongoing":
    case "queued":
    default:
      return "PROCESSING";
  }
};

// Paystack API response shape for transaction initialization.
// We only define the fields our application actually needs.
type PaystackInitializeResponse = {
  status: boolean;
  message: string;
  data?: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
};

// Paystack API response shape for transaction verification.
type PaystackVerifyResponse = {
  status: boolean;
  message: string;
  data?: {
    amount: number;
    currency: string;
    reference: string;
    status: string;
  };
};

// Paystack API response shape for refunds.
type PaystackRefundResponse = {
  status: boolean;
  message: string;
  data?: {
    amount: number;
    currency: string;
    transaction: string;
    status: string;
    id: number;
  };
};

// Creates the Paystack implementation of our common
// PaymentProviderClient interface.
//
// The rest of the application depends on the interface,
// not directly on Paystack.
export const createPaystackProvider = ({
  secretKey,
  baseUrl,
}: PaystackProviderDependencies): PaymentProviderClient => {
  // Paystack-specific Axios client.
  //
  // Authentication and base URL are configured once here
  // instead of being repeated on every request.
  const client = createAxiosClient({
    baseUrl,
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  // Initialize a transaction on Paystack.
  //
  // Paystack expects the amount in the smallest currency unit.
  // For example, NGN 5,000 becomes 500000 kobo.
  const initializePayment = async (
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> => {
    const response = await client.post<PaystackInitializeResponse>(
      "/transaction/initialize",
      {
        amount: toSubunit(input.amount),
        currency: input.currency,
        email: input.customerEmail,

        // We provide our internal payment/attempt identifiers
        // as metadata so the provider transaction can be
        // correlated with our system when necessary.
        metadata: {
          paymentId: input.paymentId,
          attemptId: input.attemptId,
          ...input.metadata,
        },

        callback_url: input.callbackUrl,
      },
    );

    const data = response.data;

    if (!data.status || !data.data) {
      throw new Error(
        data.message || "Failed to initialize Paystack payment",
      );
    }

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: data.data.reference,
      authorizationUrl: data.data.authorization_url,
      status: "PROCESSING",
      metadata: {
        accessCode: data.data.access_code,
      },
    };
  };

  // Verify an existing Paystack transaction.
  //
  // This is important because the customer's browser/callback
  // is not authoritative proof of payment.
  const verifyPayment = async (
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> => {
    const response = await client.get<PaystackVerifyResponse>(
      `/transaction/verify/${encodeURIComponent(input.providerReference)}`,
    );

    const data = response.data;

    if (!data.status || !data.data) {
      throw new Error(
        data.message || "Failed to verify Paystack payment",
      );
    }

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: data.data.reference,
      status: mapPaymentStatus(data.data.status),
      amount: (data.data.amount / 100).toFixed(2),
      currency: data.data.currency,
    };
  };

  // Request a refund from Paystack.
  //
  // This method only communicates with Paystack.
  // It does NOT update our PaymentRefund database record.
  // That responsibility belongs to the payment processing layer.
  const refundPayment = async (
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> => {
    const response = await client.post<PaystackRefundResponse>(
      "/refund",
      {
        transaction: input.providerReference,
        amount: toSubunit(input.amount),
        currency: input.currency,
        merchant_note: input.reason,
      },
    );

    const data = response.data;

    if (!data.status || !data.data) {
      throw new Error(
        data.message || "Failed to initialize Paystack refund",
      );
    }

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: input.providerReference,
      refundReference: String(data.data.id),
      status:
        data.data.status.toLowerCase() === "processed"
          ? "SUCCESS"
          : "PROCESSING",
      amount: (data.data.amount / 100).toFixed(2),
      currency: data.data.currency,
    };
  };

  // Verify that a webhook actually came from Paystack.
  //
  // Paystack signs the raw request body with HMAC-SHA512
  // using the secret key.
  const verifyWebhook = async (
    input: VerifyWebhookInput,
  ): Promise<VerifyWebhookResult> => {
    const expectedSignature = crypto
      .createHmac("sha512", secretKey)
      .update(input.rawBody)
      .digest("hex");

    const receivedSignature = input.signature;

    // Avoid a simple string comparison when possible.
    // timingSafeEqual helps prevent timing-based comparisons.
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const receivedBuffer = Buffer.from(receivedSignature, "utf8");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new Error("Invalid Paystack webhook signature");
    }

    const payload = JSON.parse(input.rawBody) as Record<string, unknown>;

    const eventId = String(payload.id ?? payload.event_id ?? "");

    const eventType = String(payload.event ?? "");

    const data =
      typeof payload.data === "object" && payload.data !== null
        ? (payload.data as Record<string, unknown>)
        : {};

    const providerReference =
      typeof data.reference === "string"
        ? data.reference
        : undefined;

    const status =
      typeof data.status === "string"
        ? mapPaymentStatus(data.status)
        : "PROCESSING";

    const amount =
      typeof data.amount === "number"
        ? (data.amount / 100).toFixed(2)
        : undefined;

    const currency =
      typeof data.currency === "string"
        ? data.currency
        : undefined;

    if (!eventId || !eventType) {
      throw new Error("Invalid Paystack webhook payload");
    }

    return {
      eventId,
      eventType,
      providerReference,
      status,
      amount,
      currency,
      payload,
    };
  };

  return {
    initializePayment,
    verifyPayment,
    refundPayment,
    verifyWebhook,
  };
};