import {
  PaymentAttemptStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
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

type ReconcilePaymentInput = {
  paymentId: string;
  userId: string;
};

type PaymentReconciliationServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
  outboxService: OutboxService;
  paymentEventFactory: PaymentEventFactory;
};

export const createPaymentReconciliationService = ({
  db,
  paymentRepository,
  paymentProviderRegistry,
  outboxService,
  paymentEventFactory,
}: PaymentReconciliationServiceDependencies) => {
  const reconcilePayment = async ({
    paymentId,
    userId,
  }: ReconcilePaymentInput) => {
    /*
     * ------------------------------------------------------------
     * 1. Find payment
     * ------------------------------------------------------------
     */
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    /*
     * ------------------------------------------------------------
     * 2. Verify ownership
     * ------------------------------------------------------------
     */
    if (payment.userId !== userId) {
      throw new Error("You cannot verify this payment");
    }

    /*
     * ------------------------------------------------------------
     * 3. Find latest payment attempt
     * ------------------------------------------------------------
     */
    const attempt = await paymentRepository.getLatestPaymentAttempt(payment.id);

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    /*
     * ------------------------------------------------------------
     * 4. Provider reference is required
     * ------------------------------------------------------------
     */
    const providerReference = attempt.providerReference;

    if (!providerReference) {
      throw new Error("Payment attempt does not have a provider reference");
    }

    /*
     * ------------------------------------------------------------
     * 5. Resolve provider
     * ------------------------------------------------------------
     */
    const provider = paymentProviderRegistry.get(attempt.provider);

    /*
     * ------------------------------------------------------------
     * 6. Ask provider for authoritative status
     * ------------------------------------------------------------
     */
    const result = await provider.verifyPayment({
      providerReference,
    });

    /*
     * ------------------------------------------------------------
     * 7. Validate amount
     * ------------------------------------------------------------
     */
    if (result.amount !== payment.amount.toFixed(2)) {
      throw new Error("Provider payment amount does not match stored payment");
    }

    /*
     * ------------------------------------------------------------
     * 8. Validate currency
     * ------------------------------------------------------------
     */
    if (result.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      throw new Error(
        "Provider payment currency does not match stored payment",
      );
    }

    /*
     * ------------------------------------------------------------
     * 9. Map provider status
     * ------------------------------------------------------------
     */
    const nextStatus = mapProviderStatusToPaymentStatus(result.status);

    const now = new Date();

    /*
     * ------------------------------------------------------------
     * 10. Payment already has this status
     * ------------------------------------------------------------
     *
     * We update verification metadata but DO NOT create
     * another domain event because there was no state change.
     */
    if (payment.status === nextStatus) {
      await paymentRepository.updatePaymentAttempt(attempt.id, {
        providerReference: result.providerReference,
        providerStatus: result.providerStatus,
        lastVerifiedAt: now,
      });

      return {
        paymentId: payment.id,
        attemptId: attempt.id,
        previousStatus: payment.status,
        status: payment.status,
        changed: false,
        verifiedAt: now,
      };
    }

    /*
     * ------------------------------------------------------------
     * 11. Protect payment state machine
     * ------------------------------------------------------------
     */
    if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
      throw new Error(
        `Invalid payment status transition: ${payment.status} -> ${nextStatus}`,
      );
    }

    /*
     * ------------------------------------------------------------
     * 12. Build payment update
     * ------------------------------------------------------------
     */
    const paymentUpdate: Prisma.PaymentUpdateInput = {
      status: nextStatus,
    };

    if (nextStatus === PaymentStatus.SUCCESS) {
      paymentUpdate.paidAt = result.paidAt ?? now;

      paymentUpdate.failedAt = null;
      paymentUpdate.failureReason = null;
    }

    if (nextStatus === PaymentStatus.FAILED) {
      paymentUpdate.failedAt = now;

      paymentUpdate.failureReason =
        result.failureReason ?? "Payment provider reported failure";
    }

    /*
     * ------------------------------------------------------------
     * 13. Build payment attempt update
     * ------------------------------------------------------------
     */
    const attemptUpdate: Prisma.PaymentAttemptUpdateInput = {
      status: mapPaymentStatusToAttemptStatus(nextStatus),
      providerReference: result.providerReference,
      providerStatus: result.providerStatus,
      lastVerifiedAt: now,
    };

    if (isTerminalPaymentStatus(nextStatus)) {
      attemptUpdate.completedAt = result.paidAt ?? now;
    }

    if (nextStatus === PaymentStatus.SUCCESS) {
      attemptUpdate.failureReason = null;
    }

    if (nextStatus === PaymentStatus.FAILED) {
      attemptUpdate.failureReason =
        result.failureReason ?? "Payment provider reported failure";
    }

    /*
     * ------------------------------------------------------------
     * 14. Update payment + attempt + outbox atomically
     * ------------------------------------------------------------
     */
    await db.$transaction(async (tx) => {
      const transactionRepository = createPaymentRepository(tx);

      const transactionOutboxRepository = createOutboxRepository(tx);

      /*
       * Lock payment before changing its state.
       */
      const lockedPayment = await transactionRepository.getByIdForUpdate(
        payment.id,
      );

      if (!lockedPayment) {
        throw new Error("Payment not found during reconciliation");
      }

      /*
       * Re-check the transition after acquiring the lock.
       *
       * Another request may have changed the payment
       * while reconciliation was calling the provider.
       */
      if (lockedPayment.status !== payment.status) {
        /*
         * Another request already moved it to the
         * status we were trying to reach.
         */
        if (lockedPayment.status === nextStatus) {
          return;
        }

        if (!canTransitionPaymentStatus(lockedPayment.status, nextStatus)) {
          throw new Error(
            `Invalid reconciliation transition: ${lockedPayment.status} -> ${nextStatus}`,
          );
        }
      }

      /*
       * ----------------------------------------------------------
       * 15. Update payment
       * ----------------------------------------------------------
       */
      await transactionRepository.updatePayment(payment.id, paymentUpdate);

      /*
       * ----------------------------------------------------------
       * 16. Update payment attempt
       * ----------------------------------------------------------
       */
      await transactionRepository.updatePaymentAttempt(
        attempt.id,
        attemptUpdate,
      );

      /*
       * ----------------------------------------------------------
       * 17. Create payment domain event
       * ----------------------------------------------------------
       */
      const paymentEvent = paymentEventFactory.create({
        paymentId: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        provider: attempt.provider,
        providerReference: result.providerReference,
        amount: payment.amount.toFixed(2),
        currency: payment.currency,
        status: nextStatus,
        occurredAt: now,
      });

      /*
       * ----------------------------------------------------------
       * 18. Store event in Outbox
       * ----------------------------------------------------------
       *
       * IMPORTANT:
       * transactionOutboxRepository uses the same Prisma
       * transaction as the payment update.
       */
      await outboxService.createEvent({
        event: paymentEvent,
        repository: transactionOutboxRepository,
      });
    });

    /*
     * ------------------------------------------------------------
     * 19. Return reconciliation result
     * ------------------------------------------------------------
     */
    return {
      paymentId: payment.id,
      attemptId: attempt.id,
      previousStatus: payment.status,
      status: nextStatus,
      changed: true,
      verifiedAt: now,
    };
  };

  return {
    reconcilePayment,
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

export type PaymentReconciliationService = ReturnType<
  typeof createPaymentReconciliationService
>;
