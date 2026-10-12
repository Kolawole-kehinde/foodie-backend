
import {
  PaymentAttemptStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import type { PaymentProviderClient } from "../providers/payment-provider.js";
import { canTransitionPaymentStatus } from "../policies/payment-status-transition.policy.js";
import {
  createPaymentRepository,
  type PaymentRepository,
} from "../repositories/index.js";
import { createOutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import type { OutboxService } from "../../outbox/services/outbox.service.js";
import type { PaymentEventFactory } from "../events/payment-event.factory.js";

type VerifyPaymentAttemptInput = {
  paymentId: string;
  attemptId: string;
  providerReference: string;
};

type VerifyPaymentAttemptDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  provider: PaymentProviderClient;
  outboxService: OutboxService;
  paymentEventFactory: PaymentEventFactory;
};

const providerStatusToPaymentStatus = {
  SUCCESS: PaymentStatus.SUCCESS,
  PROCESSING: PaymentStatus.PROCESSING,
  PENDING: PaymentStatus.PROCESSING,
  FAILED: PaymentStatus.FAILED,
  CANCELLED: PaymentStatus.CANCELLED,
  EXPIRED: PaymentStatus.EXPIRED,
} as const;

const providerStatusToAttemptStatus = (
  status: PaymentStatus,
): PaymentAttemptStatus | null => {
  switch (status) {
    case PaymentStatus.SUCCESS:
      return PaymentAttemptStatus.SUCCESS;

    case PaymentStatus.FAILED:
      return PaymentAttemptStatus.FAILED;

    case PaymentStatus.CANCELLED:
      return PaymentAttemptStatus.CANCELLED;

    case PaymentStatus.EXPIRED:
      return PaymentAttemptStatus.EXPIRED;

    case PaymentStatus.PENDING:
    case PaymentStatus.PROCESSING:
      return PaymentAttemptStatus.PROCESSING;

    default:
      return null;
  }
};

export const createVerifyPaymentAttemptHelper = ({
  db,
  paymentRepository,
  provider,
  outboxService,
  paymentEventFactory,
}: VerifyPaymentAttemptDependencies) => {
  const verifyPaymentAttempt = async ({
    paymentId,
    attemptId,
    providerReference,
  }: VerifyPaymentAttemptInput) => {
    const attempt =
      await paymentRepository.getPaymentAttemptById(attemptId);

    if (!attempt || attempt.paymentId !== paymentId) {
      throw new Error("Payment attempt not found for this payment");
    }

    if (attempt.providerReference !== providerReference) {
      throw new Error("Payment attempt provider reference does not match");
    }

    const result = await provider.verifyPayment({ providerReference });

    // An inconclusive response must not mutate local payment state.
    if (result.status === "UNKNOWN") {
      return {
        paymentId,
        attemptId,
        provider: result.provider,
        providerReference: result.providerReference,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
        persistedStatus: null,
        providerStatus: result.providerStatus,
        paidAt: result.paidAt,
        failureReason: result.failureReason,
        metadata: result.metadata,
      };
    }

    if (result.providerReference !== providerReference) {
      throw new Error(
        "Verified payment provider reference does not match",
      );
    }

    // Validate financial details before accepting provider success.
    if (result.status === "SUCCESS") {
      const expectedAmount = new Prisma.Decimal(attempt.amount.toString());
      const providerAmount = new Prisma.Decimal(result.amount);

      if (
        !providerAmount.isFinite() ||
        expectedAmount.comparedTo(providerAmount) !== 0
      ) {
        throw new Error("Verified payment amount does not match");
      }

      if (
        attempt.currency.trim().toUpperCase() !==
        result.currency.trim().toUpperCase()
      ) {
        throw new Error("Verified payment currency does not match");
      }
    }

    const outcome = await db.$transaction(async (tx) => {
      const repository = createPaymentRepository(tx);
      const outboxRepository = createOutboxRepository(tx);

      const payment = await repository.getByIdForUpdate(paymentId);

      if (!payment) {
        throw new Error("Payment not found");
      }

      const currentAttempt =
        await repository.getPaymentAttemptById(attemptId);

      if (
        !currentAttempt ||
        currentAttempt.paymentId !== paymentId ||
        currentAttempt.providerReference !== providerReference
      ) {
        throw new Error("Payment attempt changed during verification");
      }

      // Do not overwrite a payment already succeeded or refunded.
      if (
        payment.status === PaymentStatus.SUCCESS ||
        payment.status === PaymentStatus.REFUNDED ||
        payment.status === PaymentStatus.PARTIALLY_REFUNDED
      ) {
        return {
          status: payment.status,
          changed: false,
        };
      }

      // Terminal attempts cannot be revived by a later verification.
      if (
        currentAttempt.status !== PaymentAttemptStatus.INITIATED &&
        currentAttempt.status !== PaymentAttemptStatus.PROCESSING
      ) {
        return {
          status: payment.status,
          changed: false,
        };
      }

      if (
        payment.status !== PaymentStatus.PENDING &&
        payment.status !== PaymentStatus.PROCESSING
      ) {
        if (result.status === "SUCCESS") {
          throw new Error(
            `Provider reports success but payment is ${payment.status}; reconciliation is required`,
          );
        }

        return {
          status: payment.status,
          changed: false,
        };
      }
if (result.status === "UNKNOWN") {
  throw new Error(
    "Unexpected UNKNOWN provider status during verification",
  );
}

const nextStatus = providerStatusToPaymentStatus[result.status];

      if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
        throw new Error(
          `Invalid payment status transition: ${payment.status} -> ${nextStatus}`,
        );
      }

      const nextAttemptStatus =
        providerStatusToAttemptStatus(nextStatus);

      if (!nextAttemptStatus) {
        throw new Error(
          `Unsupported payment attempt status for ${nextStatus}`,
        );
      }

      const now = new Date();

      const attemptUpdate: Prisma.PaymentAttemptUpdateInput = {
        providerStatus: result.providerStatus,
        lastVerifiedAt: now,
        status: nextAttemptStatus,
      };

      const paymentUpdate: Prisma.PaymentUpdateInput = {
        status: nextStatus,
      };

      if (nextStatus === PaymentStatus.SUCCESS) {
        const paidAt = result.paidAt ?? now;

        paymentUpdate.paidAt = paidAt;
        paymentUpdate.failedAt = null;
        paymentUpdate.failureReason = null;

        attemptUpdate.failureReason = null;
        attemptUpdate.completedAt = paidAt;
      } else if (
        nextStatus === PaymentStatus.FAILED ||
        nextStatus === PaymentStatus.CANCELLED ||
        nextStatus === PaymentStatus.EXPIRED
      ) {
        const reason =
          result.failureReason ?? `Provider reported ${result.status}`;

        attemptUpdate.failureReason = reason;
        attemptUpdate.completedAt = now;

        if (nextStatus === PaymentStatus.FAILED) {
          paymentUpdate.failedAt = now;
          paymentUpdate.failureReason = reason;
        }
      }

      await repository.updatePayment(paymentId, paymentUpdate);
      await repository.updatePaymentAttempt(attemptId, attemptUpdate);

      const event = paymentEventFactory.create({
        paymentId: payment.id,
        orderId: payment.orderId,
        userId: payment.userId,
        provider: currentAttempt.provider,
        providerReference: result.providerReference,
        amount: payment.amount.toFixed(2),
        currency: payment.currency,
        status: nextStatus,
        occurredAt: now,
      });

      await outboxService.createEvent({
        event,
        repository: outboxRepository,
      });

      return {
        status: nextStatus,
        changed: true,
      };
    });

    return {
      paymentId,
      attemptId,
      provider: result.provider,
      providerReference: result.providerReference,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      persistedStatus: outcome.status,
      changed: outcome.changed,
      providerStatus: result.providerStatus,
      paidAt: result.paidAt,
      failureReason: result.failureReason,
      metadata: result.metadata,
    };
  };

  return { verifyPaymentAttempt };
};

export type VerifyPaymentAttemptHelper = ReturnType<
  typeof createVerifyPaymentAttemptHelper
>;