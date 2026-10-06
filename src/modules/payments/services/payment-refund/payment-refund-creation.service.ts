import {
  PaymentStatus,
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
  amount?: string;
  reason?: string;
};

type PaymentRefundCreationServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
};

export const createPaymentRefundCreationService = ({
  db,
  paymentRepository,
}: PaymentRefundCreationServiceDependencies) => {
  const createRefundRecord = async ({
    paymentId,
    userId,
    amount,
    reason,
  }: CreateRefundRecordInput) => {
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.userId !== userId) {
      throw new Error("You cannot refund this payment");
    }

    if (
      payment.status !== PaymentStatus.SUCCESS &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new Error(
        `Payment cannot be refunded in its current status: ${payment.status}`,
      );
    }

    const refundAmount = amount ?? payment.amount.toFixed(2);

    if (Number(refundAmount) <= 0) {
      throw new Error("Refund amount must be greater than zero");
    }

    const refund = await db.$transaction(async (tx) => {
      const transactionRepository = createPaymentRepository(tx);

      const lockedPayment = await transactionRepository.getByIdForUpdate(
        payment.id,
      );

      if (!lockedPayment) {
        throw new Error("Payment not found during refund creation");
      }

      if (lockedPayment.userId !== userId) {
        throw new Error("You cannot refund this payment");
      }

      if (
        lockedPayment.status !== PaymentStatus.SUCCESS &&
        lockedPayment.status !== PaymentStatus.PARTIALLY_REFUNDED
      ) {
        throw new Error(
          `Payment cannot be refunded in its current status: ${lockedPayment.status}`,
        );
      }

      const refundedAmount = await transactionRepository.getRefundedAmount(
        lockedPayment.id,
      );

      const remainingAmount =
        Number(lockedPayment.amount) - Number(refundedAmount);

      if (Number(refundAmount) > remainingAmount) {
        throw new Error(
          `Refund amount exceeds the remaining refundable amount: ${remainingAmount.toFixed(2)}`,
        );
      }

      const pendingStatus = RefundStatus.PENDING;
      const processingStatus = RefundStatus.PROCESSING;

      if (!canTransitionRefundStatus(pendingStatus, processingStatus)) {
        throw new Error(
          `Invalid refund status transition: ${pendingStatus} -> ${processingStatus}`,
        );
      }

      return transactionRepository.createRefund({
        payment: {
          connect: {
            id: lockedPayment.id,
          },
        },
        amount: refundAmount,
        currency: lockedPayment.currency,
        status: processingStatus,
        reason,
      });
    });

    return {
      payment,
      refund,
      refundAmount,
    };
  };

  return {
    createRefundRecord,
  };
};

export type PaymentRefundCreationService = ReturnType<
  typeof createPaymentRefundCreationService
>;