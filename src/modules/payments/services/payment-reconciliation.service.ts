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

  if (!attempt.providerReference) {
    throw new Error("Payment attempt does not have a provider reference");
  }

  const provider = paymentProviderRegistry.get(attempt.provider);
  const result = await provider.verifyPayment({
    providerReference: attempt.providerReference,
  });

  // An unknown provider result must not change local payment state.
  if (result.status === "UNKNOWN") {
    return {
      paymentId: payment.id,
      attemptId: attempt.id,
      previousStatus: payment.status,
      status: payment.status,
      changed: false,
      verifiedAt: new Date(),
    };
  }

  const expectedAmount = new Prisma.Decimal(payment.amount.toString());
  const providerAmount = new Prisma.Decimal(result.amount);

  if (expectedAmount.comparedTo(providerAmount) !== 0) {
    throw new Error("Provider payment amount does not match stored payment");
  }

  if (
    result.currency.trim().toUpperCase() !==
    payment.currency.trim().toUpperCase()
  ) {
    throw new Error("Provider payment currency does not match stored payment");
  }

  const nextStatus = mapProviderStatusToPaymentStatus(result.status);
  const now = new Date();

  return db.$transaction(async (tx) => {
    const repository = createPaymentRepository(tx);
    const outboxRepository = createOutboxRepository(tx);

    const lockedPayment = await repository.getByIdForUpdate(payment.id);

    if (!lockedPayment) {
      throw new Error("Payment not found during reconciliation");
    }

    const currentAttempt =
      await repository.getPaymentAttemptById(attempt.id);

    if (
      !currentAttempt ||
      currentAttempt.paymentId !== lockedPayment.id ||
      currentAttempt.providerReference !== attempt.providerReference
    ) {
      throw new Error("Payment attempt changed during reconciliation");
    }

    // Do not apply a stale result to a completed or superseded attempt.
    if (
      currentAttempt.status !== PaymentAttemptStatus.INITIATED &&
      currentAttempt.status !== PaymentAttemptStatus.PROCESSING
    ) {
      return {
        paymentId: lockedPayment.id,
        attemptId: currentAttempt.id,
        previousStatus: lockedPayment.status,
        status: lockedPayment.status,
        changed: false,
        verifiedAt: now,
      };
    }

    if (lockedPayment.status === nextStatus) {
      await repository.updatePaymentAttempt(currentAttempt.id, {
        providerStatus: result.providerStatus,
        lastVerifiedAt: now,
      });

      return {
        paymentId: lockedPayment.id,
        attemptId: currentAttempt.id,
        previousStatus: lockedPayment.status,
        status: lockedPayment.status,
        changed: false,
        verifiedAt: now,
      };
    }

    if (
      !canTransitionPaymentStatus(lockedPayment.status, nextStatus)
    ) {
      throw new Error(
        `Invalid reconciliation transition: ${lockedPayment.status} -> ${nextStatus}`,
      );
    }

    const paymentUpdate: Prisma.PaymentUpdateInput = {
      status: nextStatus,
    };

    const failureReason =
      result.failureReason ?? `Provider reported ${result.status}`;

    const attemptUpdate: Prisma.PaymentAttemptUpdateInput = {
      status: mapPaymentStatusToAttemptStatus(nextStatus),
      providerReference: result.providerReference,
      providerStatus: result.providerStatus,
      lastVerifiedAt: now,
    };

    if (nextStatus === PaymentStatus.SUCCESS) {
      paymentUpdate.paidAt = result.paidAt ?? now;
      paymentUpdate.failedAt = null;
      paymentUpdate.failureReason = null;
      attemptUpdate.failureReason = null;
      attemptUpdate.completedAt = result.paidAt ?? now;
    } else {
      paymentUpdate.failedAt = now;
      paymentUpdate.failureReason = failureReason;
      attemptUpdate.failureReason = failureReason;
      attemptUpdate.completedAt = now;
    }

    await repository.updatePayment(lockedPayment.id, paymentUpdate);
    await repository.updatePaymentAttempt(currentAttempt.id, attemptUpdate);

    const event = paymentEventFactory.create({
      paymentId: lockedPayment.id,
      orderId: lockedPayment.orderId,
      userId: lockedPayment.userId,
      provider: currentAttempt.provider,
      providerReference: result.providerReference,
      amount: lockedPayment.amount.toFixed(2),
      currency: lockedPayment.currency,
      status: nextStatus,
      occurredAt: now,
    });

    await outboxService.createEvent({
      event,
      repository: outboxRepository,
    });

    return {
      paymentId: lockedPayment.id,
      attemptId: currentAttempt.id,
      previousStatus: lockedPayment.status,
      status: nextStatus,
      changed: true,
      verifiedAt: now,
    };
  });
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