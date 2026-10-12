import crypto from "node:crypto";
import {
  PaymentAttemptStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
  type PaymentProvider,
} from "@prisma/client";

import { canTransitionPaymentStatus } from "../policies/payment-status-transition.policy.js";
import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";
import {
  createPaymentRepository,
  type PaymentRepository,
} from "../repositories/index.js";
import { createOutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import type { OutboxService } from "../../outbox/services/outbox.service.js";
import type { PaymentEventFactory } from "../events/payment-event.factory.js";

type HandlePaymentWebhookInput = {
  provider: PaymentProvider;
  rawBody: Buffer;
  headers: Record<string, string | undefined>;
};

type PaymentWebhookServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
  outboxService: OutboxService;
  paymentEventFactory: PaymentEventFactory;
};

export const createPaymentWebhookService = ({
  db,
  paymentRepository,
  paymentProviderRegistry,
  outboxService,
  paymentEventFactory,
}: PaymentWebhookServiceDependencies) => {
  const handleWebhook = async ({
    provider: providerName,
    rawBody,
    headers,
  }: HandlePaymentWebhookInput) => {
    // Verify the signature and normalize the provider payload.
    const provider = paymentProviderRegistry.get(providerName);

    const payloadHash = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex");

    const webhook = await provider.verifyWebhook({
      rawBody,
      headers,
    });

    // Use the provider event ID when available; otherwise build a fallback.
    const eventKey = webhook.providerEventId ?? buildWebhookEventKey(webhook);

    let webhookEvent = await paymentRepository.getWebhookEvent(
      providerName,
      eventKey,
    );

    // Persist the event once, handling concurrent duplicate deliveries.
    if (!webhookEvent) {
      try {
        webhookEvent = await paymentRepository.createWebhookEvent({
          provider: providerName,
          eventKey,
          providerEventId: webhook.providerEventId,
          eventType: webhook.eventType,
          payload: webhook.payload as Prisma.InputJsonValue,
          payloadHash,
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        webhookEvent = await paymentRepository.getWebhookEvent(
          providerName,
          eventKey,
        );

        if (!webhookEvent) {
          throw error;
        }
      }
    }

    // A completed event needs no further processing.
    if (webhookEvent.processedAt) {
      return {
        duplicate: true,
        processed: true,
        eventId: eventKey,
      };
    }

    const providerReference = webhook.providerReference;

    // Ignore events that cannot identify a payment.
    if (!providerReference) {
      await paymentRepository.markWebhookProcessed(webhookEvent.id);

      return {
        duplicate: false,
        processed: true,
        eventId: eventKey,
        ignored: true,
        reason: "Webhook does not contain a payment reference",
      };
    }

    return db.$transaction(async (tx) => {
      const repository = createPaymentRepository(tx);
      const outboxRepository = createOutboxRepository(tx);

      // Lock the event to prevent concurrent processing.
      const lockedWebhookEvent = await repository.getWebhookEventForUpdate(
        providerName,
        eventKey,
      );

      if (!lockedWebhookEvent) {
        throw new Error("Payment webhook event not found");
      }

      if (lockedWebhookEvent.processedAt) {
        return {
          duplicate: true,
          processed: true,
          eventId: eventKey,
        };
      }

      // Find and lock the payment associated with this provider reference.
      const attempt = await repository.getPaymentAttemptByProviderReference(
        providerName,
        providerReference,
      );

      if (!attempt) {
        throw new Error(
          `Payment attempt not found for provider reference: ${providerReference}`,
        );
      }

      const payment = await repository.getByIdForUpdate(attempt.paymentId);

      if (!payment) {
        throw new Error(`Payment not found for payment attempt: ${attempt.id}`);
      }

      // Reject mismatched payment details when the provider supplies them.
      if (attempt.providerReference !== providerReference) {
        throw new Error(
          "Webhook provider reference does not match the payment attempt",
        );
      }

      if (
        webhook.amount !== undefined &&
        webhook.amount !== payment.amount.toFixed(2)
      ) {
        throw new Error(
          "Webhook payment amount does not match the stored payment",
        );
      }

      if (
        webhook.currency !== undefined &&
        webhook.currency.trim().toUpperCase() !==
        payment.currency.trim().toUpperCase()
      ) {
        throw new Error(
          "Webhook payment currency does not match the stored payment",
        );
      }

      const nextStatus = mapProviderStatusToPaymentStatus(webhook.status);

      const now = new Date();

      // Mark duplicate status updates processed without emitting another event.
      if (payment.status === nextStatus) {
        await repository.markWebhookProcessed(lockedWebhookEvent.id, now);

        return {
          duplicate: false,
          processed: true,
          eventId: eventKey,
          paymentId: payment.id,
          status: payment.status,
        };
      }

      if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
        throw new Error(
          `Invalid payment status transition: ${payment.status} -> ${nextStatus}`,
        );
      }

      // Prepare the payment status update.
      const paymentUpdate: Prisma.PaymentUpdateInput = {
        status: nextStatus,
      };

      if (nextStatus === PaymentStatus.SUCCESS) {
        paymentUpdate.paidAt = webhook.paidAt ?? now;
        paymentUpdate.failedAt = null;
        paymentUpdate.failureReason = null;
      }

      if (nextStatus === PaymentStatus.FAILED) {
        paymentUpdate.failedAt = now;
        paymentUpdate.failureReason =
          webhook.failureReason ?? webhook.eventType;
      }

      // Keep the attempt status and provider verification data in sync.
      const attemptUpdate: Prisma.PaymentAttemptUpdateInput = {
        status: mapPaymentStatusToAttemptStatus(nextStatus),
        providerReference,
        providerStatus: webhook.providerStatus,
        lastVerifiedAt: now,
      };

      if (isTerminalPaymentStatus(nextStatus)) {
        attemptUpdate.completedAt = webhook.paidAt ?? now;
      }

      if (nextStatus === PaymentStatus.SUCCESS) {
        attemptUpdate.failureReason = null;
      }

      if (nextStatus === PaymentStatus.FAILED) {
        attemptUpdate.failureReason =
          webhook.failureReason ?? webhook.eventType;
      }

      await repository.updatePayment(payment.id, paymentUpdate);

      await repository.updatePaymentAttempt(attempt.id, attemptUpdate);

      // Store the domain event in the outbox within the same transaction.
      const paymentEvent = paymentEventFactory.create({
        paymentId: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        provider: providerName,
        providerReference,
        amount: payment.amount.toFixed(2),
        currency: payment.currency,
        status: nextStatus,
        occurredAt: now,
      });

      await outboxService.createEvent({
        event: paymentEvent,
        repository: outboxRepository,
      });

      // Complete the webhook only after all updates succeed.
      await repository.markWebhookProcessed(lockedWebhookEvent.id, now);

      return {
        duplicate: false,
        processed: true,
        eventId: eventKey,
        paymentId: payment.id,
        attemptId: attempt.id,
        status: nextStatus,
      };
    });
  };

  return { handleWebhook };
};

// Convert provider statuses into internal payment statuses.
const mapProviderStatusToPaymentStatus = (
  status:
    | "PENDING"
    | "PROCESSING"
    | "SUCCESS"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED"
    | "UNKNOWN",
): PaymentStatus => {
  switch (status) {
    case "SUCCESS":
      return PaymentStatus.SUCCESS;

    case "FAILED":
      return PaymentStatus.FAILED;

    case "CANCELLED":
      return PaymentStatus.CANCELLED;

    case "EXPIRED":
      return PaymentStatus.EXPIRED;

    case "PENDING":
    case "PROCESSING":
    case "UNKNOWN":
    default:
      return PaymentStatus.PROCESSING;
  }
};

// Map payment statuses to their corresponding attempt statuses.
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

// Identify statuses that complete a payment attempt.
const isTerminalPaymentStatus = (status: PaymentStatus): boolean => {
  const terminalStatuses: PaymentStatus[] = [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
    PaymentStatus.REFUNDED,
  ];

  return terminalStatuses.includes(status);
};

// Build a deterministic fallback key when the provider has no event ID.
const buildWebhookEventKey = (webhook: {
  eventType: string;
  providerReference?: string;
  providerRefundReference?: string;
  status: string;
}) => {
  return [
    webhook.eventType,
    webhook.providerReference ?? "",
    webhook.providerRefundReference ?? "",
    webhook.status,
  ].join(":");
};

// Detect duplicate event creation through Prisma's unique constraint.
const isUniqueConstraintError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
};

export type PaymentWebhookService = ReturnType<
  typeof createPaymentWebhookService
>;
