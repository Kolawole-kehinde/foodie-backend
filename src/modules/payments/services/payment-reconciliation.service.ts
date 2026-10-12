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

    return reconcilePaymentInternal(payment);
  };

  const reconcilePaymentForJob = async ({
    paymentId,
  }: ReconcilePaymentForJobInput) => {
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== PaymentStatus.PROCESSING) {
      return {
        paymentId: payment.id,
        status: payment.status,
        changed: false,
        skipped: true,
      };
    }

    return reconcilePaymentInternal(payment);
  };

  const reconcilePaymentInternal = async (
    payment: NonNullable<
      Awaited<ReturnType<typeof paymentRepository.getById>>
    >,
  ) => {
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

    const nextStatus = mapProviderStatusToPaymentStatus(result.status);
    const now = new Date();

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

    if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
      throw new Error(
        `Invalid payment status transition: ${payment.status} -> ${nextStatus}`,
      );
    }

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

    const transactionResult = await db.$transaction(
      async (
        tx,
      ): Promise<{
        changed: boolean;
        previousStatus: PaymentStatus;
      }> => {
        const transactionRepository = createPaymentRepository(tx);
        const transactionOutboxRepository = createOutboxRepository(tx);

        const lockedPayment =
          await transactionRepository.getByIdForUpdate(payment.id);

        if (!lockedPayment) {
          throw new Error("Payment not found during reconciliation");
        }

        // Another request may have completed this transition while
        // we were verifying the payment with the provider.
        if (lockedPayment.status === nextStatus) {
          return {
            changed: false,
            previousStatus: lockedPayment.status,
          };
        }

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

        await transactionRepository.updatePayment(
          lockedPayment.id,
          paymentUpdate,
        );

        await transactionRepository.updatePaymentAttempt(
          attempt.id,
          attemptUpdate,
        );

        const paymentEvent = paymentEventFactory.create({
          paymentId: lockedPayment.id,
          orderId: lockedPayment.orderId,
          userId: lockedPayment.userId,
          provider: attempt.provider,
          providerReference: result.providerReference,
          amount: lockedPayment.amount.toFixed(2),
          currency: lockedPayment.currency,
          status: nextStatus,
          occurredAt: now,
        });

        await outboxService.createEvent({
          event: paymentEvent,
          repository: transactionOutboxRepository,
        });

        return {
          changed: true,
          previousStatus: lockedPayment.status,
        };
      },
    );

    return {
      paymentId: payment.id,
      attemptId: attempt.id,
      previousStatus: transactionResult.previousStatus,
      status: nextStatus,
      changed: transactionResult.changed,
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