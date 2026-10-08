import { PaymentAttemptStatus, PaymentStatus, Prisma, PrismaClient} from "@prisma/client";
import { canTransitionPaymentStatus } from "../policies/payment-status-transition.policy.js";
import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";
import { createPaymentRepository, type PaymentRepository,} from "../repositories/index.js";
import { createOutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import type { OutboxService } from "../../outbox/services/outbox.service.js";
import type { PaymentEventFactory } from "../events/payment-event.factory.js";

type ReconcilePaymentInput = {
  paymentId: string;
  userId: string;
};

type ReconcilePaymentForJobInput = {
  paymentId: string;
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
  /**
   * User-facing reconciliation.
   *
   * Used when an authenticated user wants to verify
   * the status of their own payment.
   */
  const reconcilePayment = async ({
    paymentId,
    userId,
  }: ReconcilePaymentInput) => {
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.userId !== userId) {
      throw new Error("You cannot verify this payment");
    }

    return reconcilePaymentInternal(paymentId);
  };

  /**
   * Background reconciliation.
   *
   * Used by the scheduled payment reconciliation job.
   *
   * No user ownership check is required because this is
   * an internal system operation.
   */
  const reconcilePaymentForJob = async ({
    paymentId,
  }: ReconcilePaymentForJobInput) => {
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    /**
     * The job should only reconcile payments that are
     * currently processing.
     *
     * This also protects against a payment being changed
     * between selecting it for reconciliation and actually
     * processing it.
     */
    if (payment.status !== PaymentStatus.PROCESSING) {
      return {
        paymentId: payment.id,
        status: payment.status,
        changed: false,
        skipped: true,
      };
    }

    return reconcilePaymentInternal(paymentId);
  };

  /**
   * Shared reconciliation logic.
   *
   * This is used by both:
   *
   * - reconcilePayment()
   * - reconcilePaymentForJob()
   */
  const reconcilePaymentInternal = async (paymentId: string) => {
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    const attempt = await paymentRepository.getLatestPaymentAttempt(
      payment.id,
    );

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    const providerReference = attempt.providerReference;

    if (!providerReference) {
      throw new Error(
        "Payment attempt does not have a provider reference",
      );
    }

    const provider = paymentProviderRegistry.get(attempt.provider);

    const result = await provider.verifyPayment({
      providerReference,
    });

    /**
     * Never trust the provider blindly.
     *
     * The amount and currency returned by the provider
     * must match what we originally stored.
     */
    if (result.amount !== payment.amount.toFixed(2)) {
      throw new Error(
        "Provider payment amount does not match stored payment",
      );
    }

    if (
      result.currency.toUpperCase() !==
      payment.currency.toUpperCase()
    ) {
      throw new Error(
        "Provider payment currency does not match stored payment",
      );
    }

    const nextStatus = mapProviderStatusToPaymentStatus(
      result.status,
    );

    const now = new Date();

    /**
     * Provider returned the same status we already have.
     *
     * We still update verification metadata so we know
     * the payment was checked successfully.
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

    /**
     * Make sure the provider result represents a legal
     * payment state transition.
     */
    if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
      throw new Error(
        `Invalid payment status transition: ${payment.status} -> ${nextStatus}`,
      );
    }

    const paymentUpdate: Prisma.PaymentUpdateInput = {
      status: nextStatus,
    };

    /**
     * Successful payment.
     */
    if (nextStatus === PaymentStatus.SUCCESS) {
      paymentUpdate.paidAt = result.paidAt ?? now;
      paymentUpdate.failedAt = null;
      paymentUpdate.failureReason = null;
    }

    /**
     * Failed payment.
     */
    if (nextStatus === PaymentStatus.FAILED) {
      paymentUpdate.failedAt = now;
      paymentUpdate.failureReason =
        result.failureReason ??
        "Payment provider reported failure";
    }

    const attemptUpdate: Prisma.PaymentAttemptUpdateInput = {
      status: mapPaymentStatusToAttemptStatus(nextStatus),
      providerReference: result.providerReference,
      providerStatus: result.providerStatus,
      lastVerifiedAt: now,
    };

    /**
     * Mark the attempt as completed when the payment
     * reaches a terminal state.
     */
    if (isTerminalPaymentStatus(nextStatus)) {
      attemptUpdate.completedAt = result.paidAt ?? now;
    }

    /**
     * Clear any previous failure reason after success.
     */
    if (nextStatus === PaymentStatus.SUCCESS) {
      attemptUpdate.failureReason = null;
    }

    /**
     * Store provider failure reason.
     */
    if (nextStatus === PaymentStatus.FAILED) {
      attemptUpdate.failureReason =
        result.failureReason ??
        "Payment provider reported failure";
    }

    /**
     * Payment state change, attempt update and outbox
     * event must happen atomically.
     */
    await db.$transaction(async (tx) => {
      const transactionRepository = createPaymentRepository(tx);

      const transactionOutboxRepository =
        createOutboxRepository(tx);

      /**
       * Lock the payment row so concurrent webhook,
       * reconciliation or retry operations cannot
       * incorrectly overwrite each other.
       */
      const lockedPayment =
        await transactionRepository.getByIdForUpdate(payment.id);

      if (!lockedPayment) {
        throw new Error(
          "Payment not found during reconciliation",
        );
      }

      /**
       * Another process may have changed the payment
       * while we were calling the provider.
       */
      if (lockedPayment.status !== payment.status) {
        /**
         * Another process already moved the payment to
         * the status we were trying to reach.
         *
         * Nothing else needs to be done.
         */
        if (lockedPayment.status === nextStatus) {
          return;
        }

        /**
         * The current database status has changed into
         * another state, so validate the new transition
         * before continuing.
         */
        if (
          !canTransitionPaymentStatus(
            lockedPayment.status,
            nextStatus,
          )
        ) {
          throw new Error(
            `Invalid reconciliation transition: ${lockedPayment.status} -> ${nextStatus}`,
          );
        }
      }

      await transactionRepository.updatePayment(
        payment.id,
        paymentUpdate,
      );

      await transactionRepository.updatePaymentAttempt(
        attempt.id,
        attemptUpdate,
      );

      /**
       * Create the domain event from the final payment
       * state we just reconciled.
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

      /**
       * Outbox event is stored inside the same transaction.
       *
       * Therefore:
       *
       * payment update succeeds
       * +
       * event creation succeeds
       *
       * or neither happens.
       */
      await outboxService.createEvent({
        event: paymentEvent,
        repository: transactionOutboxRepository,
      });
    });

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
    reconcilePaymentForJob,
  };
};

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

const isTerminalPaymentStatus = (
  status: PaymentStatus,
): boolean => {
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