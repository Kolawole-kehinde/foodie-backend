import crypto from "node:crypto";

import { PaymentProvider } from "@prisma/client";

import { createAxiosClient } from "../../../../infrastructure/axios/axios.client.js";
import { PaymentProviderError } from "../../errors/payment-provider.error.js";
import type {
  InitializePaymentInput,
  InitializePaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "../../types/payment.types.js";

import {
  fromSubunit,
  getRefundProviderReference,
  getResourceType,
  getStringMetadata,
  mapPaymentStatus,
  normalizeCurrency,
  toSubunit,
} from "./paystack-mappers.js";

import type {
  PaystackInitializeResponse,
  PaystackRefundResponse,
  PaystackVerifyResponse,
} from "./paystack.types.js";
import type { PaymentProviderClient } from "../payment-provider.js";
import { createPaystackHttpHelper } from "../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../helpers/paystack-response.helper.js";

type PaystackProviderDependencies = {
  secretKey: string;
  baseUrl: string;
};

export const createPaystackProvider = ({
  secretKey,
  baseUrl,
}: PaystackProviderDependencies): PaymentProviderClient => {
  const client = createAxiosClient({
    baseUrl,
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const http = createPaystackHttpHelper(client);

  const initializePayment = async (
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult> => {
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

  const verifyPayment = async (
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult> => {
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
        data.status.toLowerCase() === "failed"
          ? (data.gateway_response ?? undefined)
          : undefined,
      metadata: getStringMetadata(data.metadata),
    };
  };

  const refundPayment = async (
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult> => {
    const amount = toSubunit(input.amount);
    const currency = normalizeCurrency(input.currency);

    const response = await http.request<PaystackRefundResponse>({
      method: "POST",
      url: "/refund",
      data: {
        transaction: input.providerReference,
        amount,
        currency,
        merchant_note: input.reason,
      },
    });

    const data = assertPaystackResponse(response.data, "payment refund");

    const normalizedStatus = data.status.trim().toLowerCase();

    let status: RefundPaymentResult["status"];

    switch (normalizedStatus) {
      case "processed":
        status = "SUCCESS";
        break;

      case "pending":
      case "processing":
      case "needs-attention":
        status = "PROCESSING";
        break;

      case "failed":
        status = "FAILED";
        break;

      default:
        status = "UNKNOWN";
    }

    return {
      provider: PaymentProvider.PAYSTACK,
      providerReference: input.providerReference,
      providerRefundReference: String(data.id),
      amount: fromSubunit(data.amount),
      currency: normalizeCurrency(data.currency),
      status,
      providerStatus: data.status,
      failureReason:
        normalizedStatus === "failed" ? (data.reason ?? undefined) : undefined,
      metadata: {
        transactionReference: getRefundProviderReference(data.transaction),
      },
    };
  };

  const verifyWebhook = async (
    input: VerifyWebhookInput,
  ): Promise<VerifyWebhookResult> => {
    const signature = input.headers["x-paystack-signature"];

    if (!signature) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "UNAUTHORIZED",
        message: "Missing Paystack webhook signature",
        retryable: false,
        uncertain: false,
      });
    }

    const expectedSignature = crypto
      .createHmac("sha512", secretKey)
      .update(input.rawBody)
      .digest("hex");

    const provided = Buffer.from(signature, "utf8");
    const expected = Buffer.from(expectedSignature, "utf8");

    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "UNAUTHORIZED",
        message: "Invalid Paystack webhook signature",
        retryable: false,
        uncertain: false,
      });
    }

    let payload: Record<string, unknown>;

    try {
      const parsed: unknown = JSON.parse(input.rawBody.toString("utf8"));

      if (
        typeof parsed !== "object" ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        throw new Error("Invalid webhook payload");
      }

      payload = parsed as Record<string, unknown>;
    } catch (error) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Invalid Paystack webhook payload",
        retryable: false,
        uncertain: false,
        cause: error,
      });
    }

    const eventType =
      typeof payload.event === "string" ? payload.event : undefined;

    if (!eventType) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Paystack webhook event is missing",
        retryable: false,
        uncertain: false,
      });
    }

    const data =
      typeof payload.data === "object" &&
      payload.data !== null &&
      !Array.isArray(payload.data)
        ? (payload.data as Record<string, unknown>)
        : {};

    const resourceType = getResourceType(eventType);

    const providerReference =
      typeof data.reference === "string" ? data.reference : undefined;

    const providerRefundReference =
      resourceType === "REFUND" && typeof data.id === "number"
        ? String(data.id)
        : undefined;

    const amount =
      typeof data.amount === "number" ? fromSubunit(data.amount) : undefined;

    const currency =
      typeof data.currency === "string"
        ? normalizeCurrency(data.currency)
        : undefined;

    const providerStatus =
      typeof data.status === "string" ? data.status : undefined;

    const paidAt =
      typeof data.paid_at === "string" ? new Date(data.paid_at) : undefined;

    const metadata = getStringMetadata(data.metadata);

    return {
      provider: PaymentProvider.PAYSTACK,
      resourceType,
      eventType,
      providerReference,
      providerRefundReference,
      amount,
      currency,
      status: providerStatus ? mapPaymentStatus(providerStatus) : "UNKNOWN",
      providerStatus,
      paidAt,
      metadata,
      payload,
    };
  };

  return {
    initializePayment,
    verifyPayment,
    verifyWebhook,
    refundPayment,
  };
};
