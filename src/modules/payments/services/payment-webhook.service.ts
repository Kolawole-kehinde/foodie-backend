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
    /*
     * ------------------------------------------------------------
     * 1. Resolve provider
     * ------------------------------------------------------------
     */
    const provider = paymentProviderRegistry.get(providerName);

    /*
     * ------------------------------------------------------------
     * 2. Generate payload hash
     * ------------------------------------------------------------
     */
    const payloadHash = crypto
      .createHash("sha256")
      .update(rawBody)
      .digest("hex");

    /*
     * ------------------------------------------------------------
     * 3. Verify signature and normalize webhook
     * ------------------------------------------------------------
     */
    const webhook = await provider.verifyWebhook({
      rawBody,
      headers,
    });

    /*
     * ------------------------------------------------------------
     * 4. Build stable event key
     * ------------------------------------------------------------
     */
    const eventKey = webhook.providerEventId ?? buildWebhookEventKey(webhook);

    /*
     * ------------------------------------------------------------
     * 5. Check whether webhook already exists
     * ------------------------------------------------------------
     */
    let webhookEvent = await paymentRepository.getWebhookEvent(
      providerName,
      eventKey,
    );

    /*
     * ------------------------------------------------------------
     * 6. Create webhook event
     * ------------------------------------------------------------
     */
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
        /*
         * Another request may have created the same webhook
         * concurrently.
         */
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

    /*
     * ------------------------------------------------------------
     * 7. Already processed
     * ------------------------------------------------------------
     */
    if (webhookEvent.processedAt) {
      return {
        duplicate: true,
        processed: true,
        eventId: eventKey,
      };
    }

    /*
     * ------------------------------------------------------------
     * 8. Webhook must contain a payment reference
     * ------------------------------------------------------------
     */
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

    /*
     * ------------------------------------------------------------
     * 9. Process webhook atomically
     * ------------------------------------------------------------
     */
    return db.$transaction(async (tx) => {
      const transactionRepository = createPaymentRepository(tx);

      const transactionOutboxRepository = createOutboxRepository(tx);

      /*
       * ----------------------------------------------------------
       * 10. Lock webhook event
       * ----------------------------------------------------------
       */
      const lockedWebhookEvent =
        await transactionRepository.getWebhookEventForUpdate(
          providerName,
          eventKey,
        );

      if (!lockedWebhookEvent) {
        throw new Error("Payment webhook event not found");
      }

      /*
       * Another request may have processed the webhook
       * while this request was waiting for the lock.
       */
      if (lockedWebhookEvent.processedAt) {
        return {
          duplicate: true,
          processed: true,
          eventId: eventKey,
        };
      }

      /*
       * ----------------------------------------------------------
       * 11. Find payment attempt
       * ----------------------------------------------------------
       */
      const attempt =
        await transactionRepository.getPaymentAttemptByProviderReference(
          providerName,
          providerReference,
        );

      if (!attempt) {
        throw new Error(
          `Payment attempt not found for provider reference: ${providerReference}`,
        );
      }

      /*
       * ----------------------------------------------------------
       * 12. Lock payment
       * ----------------------------------------------------------
       */
      const payment = await transactionRepository.getByIdForUpdate(
        attempt.paymentId,
      );

      if (!payment) {
        throw new Error(`Payment not found for payment attempt: ${attempt.id}`);
      }

      /*
       * ----------------------------------------------------------
       * 13. Validate provider reference
       * ----------------------------------------------------------
       */
      if (attempt.providerReference !== providerReference) {
        throw new Error(
          "Webhook provider reference does not match the payment attempt",
        );
      }

      /*
       * ----------------------------------------------------------
       * 14. Validate amount
       * ----------------------------------------------------------
       */
      if (
        webhook.amount !== undefined &&
        webhook.amount !== payment.amount.toFixed(2)
      ) {
        throw new Error(
          "Webhook payment amount does not match the stored payment",
        );
      }

      /*
       * ----------------------------------------------------------
       * 15. Validate currency
       * ----------------------------------------------------------
       */
      if (
        webhook.currency !== undefined &&
        webhook.currency.trim().toUpperCase() !==
          payment.currency.trim().toUpperCase()
      ) {
        throw new Error(
          "Webhook payment currency does not match the stored payment",
        );
      }

      /*
       * ----------------------------------------------------------
       * 16. Map provider status
       * ----------------------------------------------------------
       */
      const nextStatus = mapProviderStatusToPaymentStatus(webhook.status);

      /*
       * ----------------------------------------------------------
       * 17. Same status
       * ----------------------------------------------------------
       */
      if (payment.status === nextStatus) {
        const now = new Date();

        await transactionRepository.markWebhookProcessed(
          lockedWebhookEvent.id,
          now,
        );

        return {
          duplicate: false,
          processed: true,
          eventId: eventKey,
          paymentId: payment.id,
          status: payment.status,
        };
      }

      /*
       * ----------------------------------------------------------
       * 18. Validate status transition
       * ----------------------------------------------------------
       */
      if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
        throw new Error(
          `Invalid payment status transition: ${payment.status} -> ${nextStatus}`,
        );
      }

      const now = new Date();

      /*
       * ----------------------------------------------------------
       * 19. Build payment update
       * ----------------------------------------------------------
       */
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

      /*
       * ----------------------------------------------------------
       * 20. Update payment
       * ----------------------------------------------------------
       */
      await transactionRepository.updatePayment(payment.id, paymentUpdate);

      /*
       * ----------------------------------------------------------
       * 21. Build payment attempt update
       * ----------------------------------------------------------
       */
      const attemptStatus = mapPaymentStatusToAttemptStatus(nextStatus);

      const attemptUpdate: Prisma.PaymentAttemptUpdateInput = {
        status: attemptStatus,
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

      /*
       * ----------------------------------------------------------
       * 22. Update payment attempt
       * ----------------------------------------------------------
       */
      await transactionRepository.updatePaymentAttempt(
        attempt.id,
        attemptUpdate,
      );

      /*
       * ----------------------------------------------------------
       * 23. Create payment domain event
       * ----------------------------------------------------------
       *
       * PENDING is intentionally not allowed by the event
       * factory, and this point is only reached after a real
       * status transition.
       */
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

      /*
       * ----------------------------------------------------------
       * 24. Store payment event in Outbox
       * ----------------------------------------------------------
       *
       * This uses the same Prisma transaction.
       *
       * Therefore:
       *
       * Payment update
       * PaymentAttempt update
       * OutboxEvent creation
       * Webhook processed
       *
       * all commit or rollback together.
       */
      await outboxService.createEvent({
        event: paymentEvent,
        repository: transactionOutboxRepository,
      });

      /*
       * ----------------------------------------------------------
       * 25. Mark webhook as processed
       * ----------------------------------------------------------
       */
      await transactionRepository.markWebhookProcessed(
        lockedWebhookEvent.id,
        now,
      );

      /*
       * ----------------------------------------------------------
       * 26. Return result
       * ----------------------------------------------------------
       */
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

  return {
    handleWebhook,
  };
};

/*
 * --------------------------------------------------------------
 * Provider status → Payment status
 * --------------------------------------------------------------
 */
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

    case "PROCESSING":
    case "PENDING":
    case "UNKNOWN":
    default:
      return PaymentStatus.PROCESSING;
  }
};

/*
 * --------------------------------------------------------------
 * Payment status → PaymentAttempt status
 * --------------------------------------------------------------
 */
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

/*
 * --------------------------------------------------------------
 * Terminal payment status
 * --------------------------------------------------------------
 */
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

/*
 * --------------------------------------------------------------
 * Fallback webhook event key
 * --------------------------------------------------------------
 */
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

/*
 * --------------------------------------------------------------
 * Prisma unique constraint detection
 * --------------------------------------------------------------
 */
const isUniqueConstraintError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
};

export type PaymentWebhookService = ReturnType<
  typeof createPaymentWebhookService
>;
