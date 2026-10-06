import {
  PaymentStatus,
  Prisma,
  RefundStatus,
  type PrismaClient,
} from "@prisma/client";

import { canTransitionPaymentStatus } from "../../policies/payment-status-transition.policy.js";
import { canTransitionRefundStatus } from "../../policies/refund-status-transition.policy.js";

import type { PaymentProviderRegistry } from "../../providers/payment-provider.registry.js";

import {
  createPaymentRepository,
  type PaymentRepository,
} from "../../repositories/index.js";

import { createOutboxRepository } from "../../../outbox/repositories/outbox.repository.js";
import type { OutboxService } from "../../../outbox/services/outbox.service.js";

import type { PaymentEventFactory } from "../../events/payment-event.factory.js";

import { mapProviderRefundStatus } from "./payment-refund-status.service.js";

type PaymentRefundReconciliationServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
  outboxService: OutboxService;
  paymentEventFactory: PaymentEventFactory;
};

type ReconcileRefundInput = {
  refundId: string;
};

export const createPaymentRefundReconciliationService = ({
  db,
  paymentRepository,
  paymentProviderRegistry,
  outboxService,
  paymentEventFactory,
}: PaymentRefundReconciliationServiceDependencies) => {
  const reconcileRefund = async ({ refundId }: ReconcileRefundInput) => {
    const refund = await paymentRepository.getRefundById(refundId);

    if (!refund) {
      throw new Error("Refund not found");
    }

    if (refund.status !== RefundStatus.PROCESSING) {
      return refund;
    }

    const payment = await paymentRepository.getById(refund.paymentId);

    if (!payment) {
      throw new Error("Payment not found for refund");
    }

    if (!refund.providerRefundReference) {
      throw new Error("Refund does not have a provider refund reference");
    }

    const attempt = await paymentRepository.getLatestPaymentAttempt(payment.id);

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    const provider = paymentProviderRegistry.get(attempt.provider);

    const result = await provider.verifyRefund({
      providerRefundReference: refund.providerRefundReference,
    });

    if (result.amount !== refund.amount.toFixed(2)) {
      throw new Error("Provider refund amount does not match refund amount");
    }

    if (
      result.currency.trim().toUpperCase() !==
      refund.currency.trim().toUpperCase()
    ) {
      throw new Error(
        "Provider refund currency does not match refund currency",
      );
    }

    const finalStatus = mapProviderRefundStatus(result.status);

    /*
     * The refund is still processing at the provider.
     *
     * We only persist any newly returned provider reference.
     * We do not change the refund status yet.
     */
    if (finalStatus === RefundStatus.PROCESSING) {
      return db.$transaction(async (tx) => {
        const transactionRepository = createPaymentRepository(tx);

        const refundRecord = await transactionRepository.getRefundById(
          refund.id,
        );

        if (!refundRecord) {
          throw new Error("Refund not found during reconciliation");
        }

        if (refundRecord.status !== RefundStatus.PROCESSING) {
          return refundRecord;
        }

        return transactionRepository.updateRefund(refund.id, {
          providerRefundReference:
            result.providerRefundReference ??
            refundRecord.providerRefundReference,
        });
      });
    }

    if (!canTransitionRefundStatus(refund.status, finalStatus)) {
      throw new Error(
        `Invalid refund status transition: ${refund.status} -> ${finalStatus}`,
      );
    }

    const now = new Date();

    return db.$transaction(async (tx) => {
      const transactionRepository = createPaymentRepository(tx);
      const transactionOutboxRepository = createOutboxRepository(tx);

      const lockedPayment = await transactionRepository.getByIdForUpdate(
        payment.id,
      );

      if (!lockedPayment) {
        throw new Error("Payment not found during refund reconciliation");
      }

      const refundRecord = await transactionRepository.getRefundById(refund.id);

      if (!refundRecord) {
        throw new Error("Refund not found during refund reconciliation");
      }

      /*
       * Another process may have reconciled this refund
       * while this request was running.
       */
      if (refundRecord.status !== RefundStatus.PROCESSING) {
        return refundRecord;
      }

      if (!canTransitionRefundStatus(refundRecord.status, finalStatus)) {
        throw new Error(
          `Invalid refund status transition: ${refundRecord.status} -> ${finalStatus}`,
        );
      }

      const refundUpdate: Prisma.PaymentRefundUpdateInput = {
        status: finalStatus,
        providerRefundReference:
          result.providerRefundReference ??
          refundRecord.providerRefundReference,
      };

      if (finalStatus === RefundStatus.SUCCESS) {
        refundUpdate.completedAt = result.completedAt ?? now;
        refundUpdate.failureReason = null;
      }

      if (finalStatus === RefundStatus.FAILED) {
        refundUpdate.failureReason = result.failureReason ?? "Refund failed";
      }

      if (finalStatus === RefundStatus.CANCELLED) {
        refundUpdate.failureReason = result.failureReason ?? "Refund cancelled";
      }

      const updatedRefund = await transactionRepository.updateRefund(
        refund.id,
        refundUpdate,
      );

      /*
       * Only a successful refund changes the payment status.
       */
      if (finalStatus === RefundStatus.SUCCESS) {
        const totalRefunded = await transactionRepository.getRefundedAmount(
          payment.id,
        );

        const isFullRefund =
          Number(totalRefunded) >= Number(lockedPayment.amount);

        const nextPaymentStatus = isFullRefund
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;

        if (lockedPayment.status !== nextPaymentStatus) {
          if (
            !canTransitionPaymentStatus(lockedPayment.status, nextPaymentStatus)
          ) {
            throw new Error(
              `Invalid payment status transition: ${lockedPayment.status} -> ${nextPaymentStatus}`,
            );
          }

          await transactionRepository.updatePayment(payment.id, {
            status: nextPaymentStatus,
            refundedAt: isFullRefund ? now : undefined,
          });

          const paymentEvent = paymentEventFactory.create({
            paymentId: payment.id,
            orderId: payment.orderId,
            userId: payment.userId,
            provider: attempt.provider,
            providerReference: attempt.providerReference ?? undefined,
            amount: payment.amount.toFixed(2),
            currency: payment.currency,
            status: nextPaymentStatus,
            occurredAt: now,
          });

          await outboxService.createEvent({
            event: paymentEvent,
            repository: transactionOutboxRepository,
          });
        }
      }

      return updatedRefund;
    });
  };

  return {
    reconcileRefund,
  };
};

export type PaymentRefundReconciliationService = ReturnType<
  typeof createPaymentRefundReconciliationService
>;
