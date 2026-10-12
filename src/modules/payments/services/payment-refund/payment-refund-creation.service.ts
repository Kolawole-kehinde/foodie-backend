
import {
  PaymentStatus,
  Prisma,
  RefundStatus,
  type PrismaClient,
} from "@prisma/client";

import { canTransitionRefundStatus } from "../../policies/refund-status-transition.policy.js";

import {
  createPaymentRepository,
  type PaymentRepository,
} from "../../repositories/index.js";

type CreateRefundRecordInput = {
  paymentId: string;
  userId: string;
  idempotencyKey: string;
  amount?: string;
  reason?: string;
};

type PaymentRefundCreationServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
};

const parseRefundAmount = (amount: string): Prisma.Decimal => {
  let parsedAmount: Prisma.Decimal;

  try {
    parsedAmount = new Prisma.Decimal(amount);
  } catch {
    throw new Error("Refund amount must be a valid decimal amount");
  }

  if (!parsedAmount.isFinite() || !parsedAmount.gt(0)) {
    throw new Error("Refund amount must be greater than zero");
  }

  if (parsedAmount.decimalPlaces() > 2) {
    throw new Error("Refund amount cannot have more than two decimal places");
  }

  return parsedAmount;
};

export const createPaymentRefundCreationService = ({
  db,
  paymentRepository,
}: PaymentRefundCreationServiceDependencies) => {
  const createRefundRecord = async ({
    paymentId,
    userId,
    idempotencyKey,
    amount,
    reason,
  }: CreateRefundRecordInput) => {
    const normalizedIdempotencyKey = idempotencyKey.trim();

    if (!normalizedIdempotencyKey) {
      throw new Error("Refund idempotency key is required");
    }

    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.userId !== userId) {
      throw new Error("You cannot refund this payment");
    }

    const requestedAmount = parseRefundAmount(
      amount ?? payment.amount.toFixed(2),
    );

    const normalizedReason = reason?.trim() || undefined;

    return db.$transaction(async (tx) => {
      const transactionRepository = createPaymentRepository(tx);

      // Serialize refund creation for this payment.
      const lockedPayment =
        await transactionRepository.getByIdForUpdate(paymentId);

      if (!lockedPayment) {
        throw new Error("Payment not found during refund creation");
      }

      if (lockedPayment.userId !== userId) {
        throw new Error("You cannot refund this payment");
      }

      /*
       * Resolve retries before checking the current payment status.
       * An earlier request may already have completed the refund.
       */
      const existingRefund =
        await transactionRepository.getRefundByIdempotencyKey(
          paymentId,
          normalizedIdempotencyKey,
        );

      if (existingRefund) {
        const sameAmount = existingRefund.amount.equals(requestedAmount);

        const sameReason =
          (existingRefund.reason ?? null) ===
          (normalizedReason ?? null);

        if (!sameAmount || !sameReason) {
          throw new Error(
            "Refund idempotency key was already used with different input",
          );
        }

        return {
          payment: lockedPayment,
          refund: existingRefund,
          refundAmount: existingRefund.amount.toFixed(2),
        };
      }

      if (
        lockedPayment.status !== PaymentStatus.SUCCESS &&
        lockedPayment.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new Error(
          `Payment cannot be refunded in its current status: ${lockedPayment.status}`,
        );
      }

      // Includes successful and in-flight refunds to reserve their amounts.
      const refundedAmount =
        await transactionRepository.getRefundedAmount(paymentId);

      const remainingAmount = lockedPayment.amount.minus(refundedAmount);

      if (!remainingAmount.gt(0)) {
        throw new Error("Payment has no remaining refundable amount");
      }

      if (requestedAmount.gt(remainingAmount)) {
        throw new Error(
          `Refund amount exceeds the remaining refundable amount: ${remainingAmount.toFixed(2)}`,
        );
      }

      /*
       * Preserve the current lifecycle: a new refund is PROCESSING
       * before the provider request is made. This lets reconciliation
       * recover requests that reached the provider before a crash.
       */
      if (
        !canTransitionRefundStatus(
          RefundStatus.PENDING,
          RefundStatus.PROCESSING,
        )
      ) {
        throw new Error(
          `Invalid refund status transition: ${RefundStatus.PENDING} -> ${RefundStatus.PROCESSING}`,
        );
      }

      const refund = await transactionRepository.createRefund({
        payment: {
          connect: {
            id: lockedPayment.id,
          },
        },
        amount: requestedAmount.toFixed(2),
        currency: lockedPayment.currency,
        status: RefundStatus.PROCESSING,
        idempotencyKey: normalizedIdempotencyKey,
        reason: normalizedReason,
      });

      return {
        payment: lockedPayment,
        refund,
        refundAmount: requestedAmount.toFixed(2),
      };
    });
  };

  return {
    createRefundRecord,
  };
};

export type PaymentRefundCreationService = ReturnType<
  typeof createPaymentRefundCreationService
>;