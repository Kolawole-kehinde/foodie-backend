
import crypto from "node:crypto";
import { PaymentProvider } from "@prisma/client";
import { PaymentProviderError } from "../../../errors/payment-provider.error.js";
import type { VerifyWebhookInput, VerifyWebhookResult,} from "../../../types/payment.types.js";
import { fromSubunit, getResourceType, getStringMetadata, mapPaymentStatus, normalizeCurrency,} from "../paystack-mappers.js";

type VerifyWebhookOperationDependencies = {
  secretKey: string;
};

const isRecord = ( value: unknown): value is Record<string, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value);


export const createVerifyWebhookOperation = ({ secretKey}: VerifyWebhookOperationDependencies) => {

  const verifyWebhook = async ( input: VerifyWebhookInput): Promise<VerifyWebhookResult> => {
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

    const data = isRecord(payload.data) ? payload.data : {};
    const resourceType = getResourceType(eventType);

    const providerReference =
      typeof data.reference === "string" ? data.reference : undefined;

    const providerRefundReference =
      resourceType === "REFUND" && typeof data.id === "number"
        ? String(data.id)
        : undefined;

    const amount =
      typeof data.amount === "number"
        ? fromSubunit(data.amount)
        : undefined;

    const currency =
      typeof data.currency === "string"
        ? normalizeCurrency(data.currency)
        : undefined;

    const providerStatus =
      typeof data.status === "string" ? data.status : undefined;

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
      status: providerStatus
        ? mapPaymentStatus(providerStatus)
        : "UNKNOWN",
      providerStatus,
      paidAt,
      metadata: getStringMetadata(data.metadata),
      payload,
    };
  };

  return verifyWebhook;
};
