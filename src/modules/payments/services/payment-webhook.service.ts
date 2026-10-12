
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
import type { PaymentProviderStatus } from "../types/payment.types.js";

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
    const provider = paymentProviderRegistry.get(providerName);

    // Verify the signature before persisting or processing the event.
    const webhook = await provider.verifyWebhook({
      rawBody,
      headers,
    });

    const payloadHash = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex");

    const eventKey =
      webhook.providerEventId ?? buildWebhookEventKey(webhook);

    let webhookEvent = await paymentRepository.getWebhookEvent(
      providerName,
      eventKey,
    );

    // Persist once; concurrent deliveries may race on the unique key.
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

    if (webhookEvent.processedAt) {
      return {
        duplicate: true,
        processed: true,
        eventId: eventKey,
      };
    }

    // Refund webhooks must be handled by the refund workflow.
    // Leave them unprocessed until that workflow is implemented.
    if (
      webhook.providerRefundReference ||
      webhook.eventType.toLowerCase().includes("refund")
    ) {
      throw new Error(
        "Refund webhook received; refund processing is not configured",
      );
    }

    const providerReference = webhook.providerReference;

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

    // Unknown provider status is inconclusive; do not change payment state.
    if (webhook.status === "UNKNOWN") {
      await paymentRepository.markWebhookProcessed(webhookEvent.id);

      return {
        duplicate: false,
        processed: true,
        eventId: eventKey,
        ignored: true,
        reason: "Provider webhook status is unknown",
      };
    }

    // The guard above excludes UNKNOWN. The mapper therefore returns
    // a valid PaymentStatus and never requires nullable status handling.
    const nextStatus = mapProviderStatusToPaymentStatus(webhook.status);

    return db.$transaction(async (tx) => {
      const repository = createPaymentRepository(tx);
      const outboxRepository = createOutboxRepository(tx);

      // Serialize concurrent processing of this webhook event.
      const lockedEvent = await repository.getWebhookEventForUpdate(
        providerName,
        eventKey,
      );

      if (!lockedEvent) {
        throw new Error("Payment webhook event not found");
      }

      if (lockedEvent.processedAt) {
        return {
          duplicate: true,
          processed: true,
          eventId: eventKey,
        };
      }

      const initialAttempt =
        await repository.getPaymentAttemptByProviderReference(
          providerName,
          providerReference,
        );

      if (!initialAttempt) {
        throw new Error(
          `Payment attempt not found for provider reference: ${providerReference}`,
        );
      }

      // Lock the payment, then re-read the attempt to avoid using stale state.
      const payment = await repository.getByIdForUpdate(
        initialAttempt.paymentId,
      );

      if (!payment) {
        throw new Error(
          `Payment not found for payment attempt: ${initialAttempt.id}`,
        );
      }

      const attempt = await repository.getPaymentAttemptById(
        initialAttempt.id,
      );

      if (!attempt) {
        throw new Error(
          `Payment attempt not found: ${initialAttempt.id}`,
        );
      }

      if (attempt.paymentId !== payment.id) {
        throw new Error(
          "Payment attempt does not belong to the locked payment",
        );
      }

      if (
        attempt.provider !== providerName ||
        attempt.providerReference !== providerReference
      ) {
        throw new Error(
          "Webhook provider reference does not match the payment attempt",
        );
      }

      if (webhook.amount !== undefined) {
        let webhookAmount: Prisma.Decimal;

        try {
          webhookAmount = new Prisma.Decimal(webhook.amount);
        } catch {
          throw new Error("Webhook contains an invalid payment amount");
        }

        const expectedAmount = new Prisma.Decimal(
          payment.amount.toString(),
        );

        if (
          !webhookAmount.isFinite() ||
          expectedAmount.comparedTo(webhookAmount) !== 0
        ) {
          throw new Error(
            "Webhook payment amount does not match the stored payment",
          );
        }
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

      const now = new Date();

      // Repeated status notifications are idempotent.
      if (payment.status === nextStatus) {
        await repository.markWebhookProcessed(lockedEvent.id, now);

        return {
          duplicate: false,
          processed: true,
          eventId: eventKey,
          paymentId: payment.id,
          attemptId: attempt.id,
          status: payment.status,
          changed: false,
        };
      }

      // A terminal attempt cannot be reused to change payment state.
      if (!isActiveAttempt(attempt.status)) {
        await repository.markWebhookProcessed(lockedEvent.id, now);

        return {
          duplicate: false,
          processed: true,
          eventId: eventKey,
          paymentId: payment.id,
          attemptId: attempt.id,
          status: payment.status,
          changed: false,
          ignored: true,
          reason: "Payment attempt is already terminal",
        };
      }

      if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
        // A success notification after a conflicting state requires
        // reconciliation instead of silently acknowledging the event.
        if (nextStatus === PaymentStatus.SUCCESS) {
          throw new Error(
            `Provider reports success but payment is ${payment.status}; reconciliation is required`,
          );
        }

        await repository.markWebhookProcessed(lockedEvent.id, now);

        return {
          duplicate: false,
          processed: true,
          eventId: eventKey,
          paymentId: payment.id,
          attemptId: attempt.id,
          status: payment.status,
          changed: false,
          ignored: true,
          reason: `Invalid transition: ${payment.status} -> ${nextStatus}`,
        };
      }

      const paymentUpdate: Prisma.PaymentUpdateInput = {
        status: nextStatus,
      };

      const attemptUpdate: Prisma.PaymentAttemptUpdateInput = {
        status: mapPaymentStatusToAttemptStatus(nextStatus),
        providerReference,
        providerStatus: webhook.providerStatus,
        lastVerifiedAt: now,
      };

      if (nextStatus === PaymentStatus.SUCCESS) {
        const paidAt = webhook.paidAt ?? now;

        paymentUpdate.paidAt = paidAt;
        paymentUpdate.failedAt = null;
        paymentUpdate.failureReason = null;

        attemptUpdate.failureReason = null;
        attemptUpdate.completedAt = paidAt;
      } else if (isTerminalPaymentStatus(nextStatus)) {
        const failureReason =
          webhook.failureReason ??
          `Provider reported ${webhook.status}`;

        // failedAt is reserved for an actual FAILED status.
        if (nextStatus === PaymentStatus.FAILED) {
          paymentUpdate.failedAt = now;
          paymentUpdate.failureReason = failureReason;
        }

        attemptUpdate.failureReason = failureReason;
        attemptUpdate.completedAt = now;
      }

      await repository.updatePayment(payment.id, paymentUpdate);

      await repository.updatePaymentAttempt(
        attempt.id,
        attemptUpdate,
      );

      // Persist the domain event atomically with the payment updates.
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

      await repository.markWebhookProcessed(lockedEvent.id, now);

      return {
        duplicate: false,
        processed: true,
        eventId: eventKey,
        paymentId: payment.id,
        attemptId: attempt.id,
        status: nextStatus,
        changed: true,
      };
    });
  };

  return { handleWebhook };
};

const mapProviderStatusToPaymentStatus = (
  status: Exclude<PaymentProviderStatus, "UNKNOWN">,
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

    default:
      return PaymentAttemptStatus.PROCESSING;
  }
};

const isActiveAttempt = (
  status: PaymentAttemptStatus,
): boolean =>
  status === PaymentAttemptStatus.INITIATED ||
  status === PaymentAttemptStatus.PROCESSING;

const isTerminalPaymentStatus = (
  status: PaymentStatus,
): boolean =>
  status === PaymentStatus.FAILED ||
  status === PaymentStatus.CANCELLED ||
  status === PaymentStatus.EXPIRED;

const buildWebhookEventKey = (webhook: {
  eventType: string;
  providerReference?: string;
  providerRefundReference?: string;
  status: string;
}) =>
  [
    webhook.eventType,
    webhook.providerReference ?? "",
    webhook.providerRefundReference ?? "",
    webhook.status,
  ].join(":");

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export type PaymentWebhookService = ReturnType<
  typeof createPaymentWebhookService
>;
