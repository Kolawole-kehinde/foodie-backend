import {
  PaymentAttemptStatus,
  PaymentStatus,
  type PaymentProvider,
} from "@prisma/client";

import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";
import type { PaymentRepository } from "../repositories/payment.repository.js";
import { canTransitionPaymentStatus } from "../policies/payment-status-transition.policy.js";


type HandlePaymentWebhookInput = {
  provider: PaymentProvider;
  rawBody: string;
  signature: string;
};

type PaymentWebhookServiceDependencies = {
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
};

export const createPaymentWebhookService = ({
  paymentRepository,
  paymentProviderRegistry,
}: PaymentWebhookServiceDependencies) => {
  const handleWebhook = async ({
    provider: providerName,
    rawBody,
    signature,
  }: HandlePaymentWebhookInput) => {
    // 1. Resolve provider
    const provider = paymentProviderRegistry.getProvider(providerName);

    // 2. Verify signature and normalize provider payload
    const webhook = await provider.verifyWebhook({
      rawBody,
      signature,
    });

    // 3. Check whether this webhook was already processed
    const existingEvent = await paymentRepository.getWebhookEvent(
      providerName,
      webhook.eventId,
    );

    if (existingEvent) {
      return {
        duplicate: true,
        processed: Boolean(existingEvent.processedAt),
        eventId: webhook.eventId,
      };
    }

    // 4. Persist webhook event before processing
    const webhookEvent = await paymentRepository.createWebhookEvent({
      provider: providerName,
      eventId: webhook.eventId,
      eventType: webhook.eventType,
      payload: webhook.payload,
    });

    // 5. Webhook must contain a provider reference
    if (!webhook.providerReference) {
      await paymentRepository.markWebhookProcessed(webhookEvent.id);

      return {
        duplicate: false,
        processed: true,
        eventId: webhook.eventId,
        ignored: true,
        reason: "Webhook does not contain a payment reference",
      };
    }

    // 6. Find our payment
    const payment = await paymentRepository.getByProviderReference(
      webhook.providerReference,
    );

    if (!payment) {
      throw new Error(
        `Payment not found for provider reference: ${webhook.providerReference}`,
      );
    }

    // 7. Validate amount when supplied by provider
    if (
      webhook.amount !== undefined &&
      webhook.amount !== payment.amount.toFixed(2)
    ) {
      throw new Error(
        "Webhook payment amount does not match the stored payment",
      );
    }

    // 8. Validate currency when supplied by provider
    if (
      webhook.currency !== undefined &&
      webhook.currency.toUpperCase() !== payment.currency.toUpperCase()
    ) {
      throw new Error(
        "Webhook payment currency does not match the stored payment",
      );
    }

    // 9. Map provider status to our payment status
    const nextStatus = mapProviderStatusToPaymentStatus(webhook.status);

    // 10. Ignore duplicate/outdated state transitions
    if (payment.status === nextStatus) {
      await paymentRepository.markWebhookProcessed(webhookEvent.id);

      return {
        duplicate: false,
        processed: true,
        eventId: webhook.eventId,
        paymentId: payment.id,
        status: payment.status,
      };
    }

    // 11. Validate state transition
    if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
      throw new Error(
        `Invalid payment status transition: ${payment.status} -> ${nextStatus}`,
      );
    }

    // 12. Update payment
    const now = new Date();

    const paymentUpdate: {
      status: PaymentStatus;
      paidAt?: Date;
      failedAt?: Date;
      failureReason?: string;
    } = {
      status: nextStatus,
    };

    if (nextStatus === PaymentStatus.SUCCESS) {
      paymentUpdate.paidAt = now;
      paymentUpdate.failedAt = undefined;
      paymentUpdate.failureReason = undefined;
    }

    if (nextStatus === PaymentStatus.FAILED) {
      paymentUpdate.failedAt = now;
      paymentUpdate.failureReason = webhook.eventType;
    }

    await paymentRepository.updatePayment(payment.id, paymentUpdate);

    // 13. Update the corresponding payment attempt
    const attempt =
      await paymentRepository.getPaymentAttemptByProviderReference(
        providerName,
        webhook.providerReference,
      );

    if (attempt) {
      const attemptStatus = mapPaymentStatusToAttemptStatus(nextStatus);

      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: attemptStatus,
        completedAt: isTerminalPaymentStatus(nextStatus) ? now : undefined,
        failureReason:
          nextStatus === PaymentStatus.FAILED ? webhook.eventType : undefined,
      });
    }

    // 14. Mark webhook as processed
    await paymentRepository.markWebhookProcessed(webhookEvent.id, now);

    return {
      duplicate: false,
      processed: true,
      eventId: webhook.eventId,
      paymentId: payment.id,
      status: nextStatus,
    };
  };

  return {
    handleWebhook,
  };
};

const mapProviderStatusToPaymentStatus = (
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED",
): PaymentStatus => {
  switch (status) {
    case "SUCCESS":
      return PaymentStatus.SUCCESS;

    case "FAILED":
      return PaymentStatus.FAILED;

    case "CANCELLED":
      return PaymentStatus.CANCELLED;

    case "PROCESSING":
    default:
      return PaymentStatus.PROCESSING;
  }
};

const mapPaymentStatusToAttemptStatus = (
  status: PaymentStatus,
): PaymentAttemptStatus => {
  switch (status) {
    case PaymentStatus.SUCCESS:
      return PaymentAttemptStatus.SUCCESS;

    case PaymentStatus.FAILED:
      return PaymentAttemptStatus.FAILED;

    case PaymentStatus.CANCELLED:
      return PaymentAttemptStatus.CANCELLED;

    case PaymentStatus.EXPIRED:
      return PaymentAttemptStatus.EXPIRED;

    case PaymentStatus.PROCESSING:
    case PaymentStatus.PENDING:
    default:
      return PaymentAttemptStatus.PROCESSING;
  }
};

const isTerminalPaymentStatus = (status: PaymentStatus): boolean => {
  return [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
    PaymentStatus.REFUNDED,
  ].includes(status);
};

export type PaymentWebhookService = ReturnType<
  typeof createPaymentWebhookService
>;
