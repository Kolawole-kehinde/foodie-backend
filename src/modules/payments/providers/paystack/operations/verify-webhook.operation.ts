
import crypto from "node:crypto";
import { PaymentProvider } from "@prisma/client";

import { PaymentProviderError } from "../../../errors/payment-provider.error.js";
import type {
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "../../../types/payment.types.js";

import {
  fromSubunit,
  getRefundProviderReference,
  getResourceType,
  getStringMetadata,
  mapPaymentStatus,
  mapRefundStatus,
  normalizeProviderCurrency,
} from "../paystack-mappers.js";

type VerifyWebhookOperationDependencies = {
  secretKey: string;
};

const isRecord = (
  value: unknown,
): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value);

export const createVerifyWebhookOperation = ({
  secretKey,
}: VerifyWebhookOperationDependencies) => {
  const verifyWebhook = async (
    input: VerifyWebhookInput,
  ): Promise<VerifyWebhookResult> => {
    const signature = input.headers["x-paystack-signature"];

    if (
      typeof signature !== "string" ||
      !/^[a-f0-9]{128}$/i.test(signature)
    ) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "UNAUTHORIZED",
        message: "Invalid or missing Paystack webhook signature",
        retryable: false,
        uncertain: false,
      });
    }

    const expectedSignature = crypto
      .createHmac("sha512", secretKey)
      .update(input.rawBody)
      .digest();

    const providedSignature = Buffer.from(signature, "hex");

    if (
      providedSignature.length !== expectedSignature.length ||
      !crypto.timingSafeEqual(
        providedSignature,
        expectedSignature,
      )
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
      const parsed: unknown = JSON.parse(
        input.rawBody.toString("utf8"),
      );

      if (!isRecord(parsed)) {
        throw new Error("Webhook payload must be a JSON object");
      }

      payload = parsed;
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
      typeof payload.event === "string" &&
      payload.event.trim().length > 0
        ? payload.event
        : undefined;

    if (!eventType || !isRecord(payload.data)) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Paystack webhook event or data is invalid",
        retryable: false,
        uncertain: false,
      });
    }

    const data = payload.data;
    const resourceType = getResourceType(eventType);

    let providerReference =
      typeof data.reference === "string" &&
      data.reference.trim().length > 0
        ? data.reference
        : undefined;

    let providerRefundReference: string | undefined;

    if (resourceType === "REFUND") {
      if (
        !(
          (typeof data.id === "string" &&
            data.id.trim().length > 0) ||
          (typeof data.id === "number" &&
            Number.isSafeInteger(data.id) &&
            data.id > 0)
        )
      ) {
        throw new PaymentProviderError({
          provider: "PAYSTACK",
          code: "INVALID_RESPONSE",
          message: "Paystack webhook contains an invalid refund ID",
          retryable: false,
          uncertain: false,
        });
      }

      providerRefundReference = String(data.id);

      const transactionReference =
        getRefundProviderReference(
          data.transaction as
            | number
            | string
            | { id?: number; reference?: string },
        );

      if (
        typeof transactionReference !== "string" ||
        transactionReference.trim().length === 0
      ) {
        throw new PaymentProviderError({
          provider: "PAYSTACK",
          code: "INVALID_RESPONSE",
          message:
            "Paystack refund webhook is missing its transaction reference",
          retryable: false,
          uncertain: false,
        });
      }

      providerReference = transactionReference;
    }

    let amount: string | undefined;
    let currency: string | undefined;

    try {
      if (typeof data.amount === "number") {
        amount = fromSubunit(data.amount);
      }

      if (typeof data.currency === "string") {
        currency = normalizeProviderCurrency(data.currency);
      }
    } catch (error) {
      throw new PaymentProviderError({
        provider: "PAYSTACK",
        code: "INVALID_RESPONSE",
        message: "Paystack webhook contains invalid payment data",
        retryable: false,
        uncertain: false,
        cause: error,
      });
    }

    const providerStatus =
      typeof data.status === "string"
        ? data.status
        : undefined;

    const status = providerStatus
      ? resourceType === "REFUND"
        ? mapRefundStatus(providerStatus)
        : resourceType === "PAYMENT"
          ? mapPaymentStatus(providerStatus)
          : "UNKNOWN"
      : "UNKNOWN";

    const paidAt =
      typeof data.paid_at === "string"
        ? new Date(data.paid_at)
        : undefined;

    return {
      provider: PaymentProvider.PAYSTACK,
      resourceType,
      eventType,
      providerReference,
      providerRefundReference,
      amount,
      currency,
      status,
      providerStatus,
      paidAt:
        paidAt && !Number.isNaN(paidAt.getTime())
          ? paidAt
          : undefined,
      metadata: getStringMetadata(data.metadata),
      payload,
    };
  };

  return verifyWebhook;
};
