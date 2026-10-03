import { PaymentStatus, RefundStatus } from "@prisma/client";

import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";
import type { PaymentRepository } from "../repositories/payment.repository.js";

type CreatePaymentRefundInput = {
  paymentId: string;
  userId: string;
  amount?: string;
  reason?: string;
};

type PaymentRefundServiceDependencies = {
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
};

export const createPaymentRefundService = ({
  paymentRepository,
  paymentProviderRegistry,
}: PaymentRefundServiceDependencies) => {
  const createRefund = async ({
    paymentId,
    userId,
    amount,
    reason,
  }: CreatePaymentRefundInput) => {
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

    if (!payment.providerReference) {
      throw new Error("Payment does not have a provider reference");
    }

    const refundAmount = amount ?? payment.amount.toFixed(2);

    if (Number(refundAmount) <= 0) {
      throw new Error("Refund amount must be greater than zero");
    }

    const refundedAmount = await paymentRepository.getRefundedAmount(
      payment.id,
    );

    const remainingAmount = Number(payment.amount) - Number(refundedAmount);

    if (Number(refundAmount) > remainingAmount) {
      throw new Error(
        `Refund amount exceeds the remaining refundable amount: ${remainingAmount.toFixed(2)}`,
      );
    }

    const provider = paymentProviderRegistry.getProvider(payment.provider);

    const refund = await paymentRepository.createRefund({
      payment: {
        connect: {
          id: payment.id,
        },
      },
      amount: refundAmount,
      currency: payment.currency,
      status: RefundStatus.PENDING,
      reason,
    });

    try {
      await paymentRepository.updateRefund(refund.id, {
        status: RefundStatus.PROCESSING,
      });

      const result = await provider.refundPayment({
        providerReference: payment.providerReference,
        amount: refundAmount,
        currency: payment.currency,
        reason,
      });

      const finalStatus = mapProviderRefundStatus(result.status);

      const completedAt =
        finalStatus === RefundStatus.SUCCESS ? new Date() : undefined;

      const updatedRefund = await paymentRepository.updateRefund(refund.id, {
        status: finalStatus,
        providerReference: result.refundReference,
        completedAt,
        reason: result.failureReason ?? reason,
      });

      if (finalStatus === RefundStatus.SUCCESS) {
        const isFullRefund =
          Number(refundedAmount) + Number(refundAmount) ===
          Number(payment.amount);

        await paymentRepository.updatePayment(payment.id, {
          status: isFullRefund
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED,
          refundedAt: isFullRefund ? new Date() : undefined,
        });
      }

      return updatedRefund;
    } catch (error) {
      await paymentRepository.updateRefund(refund.id, {
        status: RefundStatus.FAILED,
        reason:
          error instanceof Error ? error.message : "Refund processing failed",
      });

      throw error;
    }
  };

  return {
    createRefund,
  };
};

const mapProviderRefundStatus = (
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED",
): RefundStatus => {
  switch (status) {
    case "SUCCESS":
      return RefundStatus.SUCCESS;

    case "FAILED":
      return RefundStatus.FAILED;

    case "CANCELLED":
      return RefundStatus.CANCELLED;

    case "PROCESSING":
    default:
      return RefundStatus.PROCESSING;
  }
};

export type PaymentRefundService = ReturnType<
  typeof createPaymentRefundService
>;
