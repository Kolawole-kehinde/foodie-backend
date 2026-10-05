import {
  PaymentStatus,
  Prisma,
  RefundStatus,
  type PrismaClient,
} from "@prisma/client";

import { canTransitionPaymentStatus } from "../policies/payment-status-transition.policy.js";
import { canTransitionRefundStatus } from "../policies/refund-status-transition.policy.js";

import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";

import {
  createPaymentRepository,
  type PaymentRepository,
} from "../repositories/index.js";

import type { PaymentProviderStatus } from "../types/payment.types.js";

import { createOutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import type { OutboxService } from "../../outbox/services/outbox.service.js";

import type { PaymentEventFactory } from "../events/payment-event.factory.js";

type CreatePaymentRefundInput = {
  paymentId: string;
  userId: string;
  amount?: string;
  reason?: string;
};

type PaymentRefundServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
  outboxService: OutboxService;
  paymentEventFactory: PaymentEventFactory;
};

export const createPaymentRefundService = ({
  db,
  paymentRepository,
  paymentProviderRegistry,
  outboxService,
  paymentEventFactory,
}: PaymentRefundServiceDependencies) => {
  const createRefund = async ({
    paymentId,
    userId,
    amount,
    reason,
  }: CreatePaymentRefundInput) => {
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
      throw new Error("You cannot refund this payment");
    }

    /*
     * ------------------------------------------------------------
     * 3. Validate payment status
     * ------------------------------------------------------------
     */
    if (
      payment.status !== PaymentStatus.SUCCESS &&
      payment.status !== PaymentStatus.PARTIALLY_REFUNDED
    ) {
      throw new Error(
        `Payment cannot be refunded in its current status: ${payment.status}`,
      );
    }

    /*
     * ------------------------------------------------------------
     * 4. Find latest payment attempt
     * ------------------------------------------------------------
     *
     * Provider reference belongs to PaymentAttempt.
     */
    const attempt = await paymentRepository.getLatestPaymentAttempt(payment.id);

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

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
     * 6. Determine refund amount
     * ------------------------------------------------------------
     */
    const refundAmount = amount ?? payment.amount.toFixed(2);

    if (Number(refundAmount) <= 0) {
      throw new Error("Refund amount must be greater than zero");
    }

    /*
     * ------------------------------------------------------------
     * 7. Create refund reservation
     * ------------------------------------------------------------
     *
     * The payment is locked while we calculate the remaining
     * refundable amount.
     *
     * The refund is immediately moved to PROCESSING.
     */
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

      const createdRefund = await transactionRepository.createRefund({
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

      return createdRefund;
    });

    /*
     * ------------------------------------------------------------
     * 8. Call payment provider
     * ------------------------------------------------------------
     *
     * This happens OUTSIDE the database transaction.
     *
     * Never hold a PostgreSQL lock while waiting for an
     * external provider.
     */
    try {
      const result = await provider.refundPayment({
        paymentId: payment.id,
        providerReference,
        amount: refundAmount,
        currency: payment.currency,
        reason,
      });

      /*
       * ----------------------------------------------------------
       * 9. Validate provider refund amount
       * ----------------------------------------------------------
       */
      if (result.amount !== refundAmount) {
        throw new Error(
          "Provider refund amount does not match requested refund amount",
        );
      }

      /*
       * ----------------------------------------------------------
       * 10. Validate provider refund currency
       * ----------------------------------------------------------
       */
      if (
        result.currency.trim().toUpperCase() !==
        payment.currency.trim().toUpperCase()
      ) {
        throw new Error(
          "Provider refund currency does not match payment currency",
        );
      }

      /*
       * ----------------------------------------------------------
       * 11. Map provider status
       * ----------------------------------------------------------
       */
      const finalStatus = mapProviderRefundStatus(result.status);

      if (!canTransitionRefundStatus(refund.status, finalStatus)) {
        throw new Error(
          `Invalid refund status transition: ${refund.status} -> ${finalStatus}`,
        );
      }

      const now = new Date();

      /*
       * ----------------------------------------------------------
       * 12. Update refund + payment + outbox atomically
       * ----------------------------------------------------------
       */
      return await db.$transaction(async (tx) => {
        const transactionRepository = createPaymentRepository(tx);

        const transactionOutboxRepository = createOutboxRepository(tx);

        /*
         * Lock payment.
         */
        const lockedPayment = await transactionRepository.getByIdForUpdate(
          payment.id,
        );

        if (!lockedPayment) {
          throw new Error("Payment not found during refund processing");
        }

        /*
         * Find refund.
         */
        const refundRecord = await transactionRepository.getRefundById(
          refund.id,
        );

        if (!refundRecord) {
          throw new Error("Refund not found during refund processing");
        }

        /*
         * Another process may have already completed
         * this refund.
         */
        if (refundRecord.status !== RefundStatus.PROCESSING) {
          return refundRecord;
        }

        if (!canTransitionRefundStatus(refundRecord.status, finalStatus)) {
          throw new Error(
            `Invalid refund status transition: ${refundRecord.status} -> ${finalStatus}`,
          );
        }

        /*
         * ------------------------------------------------------
         * 13. Build refund update
         * ------------------------------------------------------
         */
        const refundUpdate: Prisma.PaymentRefundUpdateInput = {
          status: finalStatus,
          providerRefundReference: result.providerRefundReference,
        };

        if (finalStatus === RefundStatus.SUCCESS) {
          refundUpdate.completedAt = now;
          refundUpdate.failureReason = null;
        }

        if (finalStatus === RefundStatus.FAILED) {
          refundUpdate.failureReason = result.failureReason ?? "Refund failed";
        }

        if (finalStatus === RefundStatus.CANCELLED) {
          refundUpdate.failureReason =
            result.failureReason ?? "Refund cancelled";
        }

        /*
         * ------------------------------------------------------
         * 14. Update refund
         * ------------------------------------------------------
         */
        const updatedRefund = await transactionRepository.updateRefund(
          refund.id,
          refundUpdate,
        );

        /*
         * ------------------------------------------------------
         * 15. Only successful refunds change Payment status
         * ------------------------------------------------------
         */
        if (finalStatus === RefundStatus.SUCCESS) {
          /*
           * Recalculate the total refunded amount after
           * this refund has been marked SUCCESS.
           */
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
              !canTransitionPaymentStatus(
                lockedPayment.status,
                nextPaymentStatus,
              )
            ) {
              throw new Error(
                `Invalid payment status transition: ${lockedPayment.status} -> ${nextPaymentStatus}`,
              );
            }

            /*
             * --------------------------------------------------
             * 16. Update Payment
             * --------------------------------------------------
             */
            await transactionRepository.updatePayment(payment.id, {
              status: nextPaymentStatus,
              refundedAt: isFullRefund ? now : undefined,
            });

            /*
             * --------------------------------------------------
             * 17. Create Payment domain event
             * --------------------------------------------------
             */
            const paymentEvent = paymentEventFactory.create({
              paymentId: payment.id,
              orderId: payment.orderId,
              userId: payment.userId,
              provider: attempt.provider,
              providerReference,
              amount: payment.amount.toFixed(2),
              currency: payment.currency,
              status: nextPaymentStatus,
              occurredAt: now,
            });

            /*
             * ------------------------------------------------
             * 18. Store Payment event in Outbox
             * ------------------------------------------------
             */
            await outboxService.createEvent({
              event: paymentEvent,
              repository: transactionOutboxRepository,
            });
          }
        }

        /*
         * ------------------------------------------------------
         * 19. Return updated refund
         * ------------------------------------------------------
         */
        return updatedRefund;
      });
    } catch (error) {
      /*
       * IMPORTANT:
       *
       * If the provider call fails because of timeout,
       * network error, 5xx, connection reset, etc.,
       * we do NOT automatically mark the refund FAILED.
       *
       * The refund remains PROCESSING so webhook/reconciliation
       * can determine the real provider state later.
       */
      throw error;
    }
  };

  return {
    createRefund,
  };
};

const mapProviderRefundStatus = (
  status: PaymentProviderStatus,
): RefundStatus => {
  switch (status) {
    case "SUCCESS":
      return RefundStatus.SUCCESS;

    case "FAILED":
      return RefundStatus.FAILED;

    case "CANCELLED":
      return RefundStatus.CANCELLED;

    case "PROCESSING":
    case "PENDING":
    case "EXPIRED":
    case "UNKNOWN":
    default:
      return RefundStatus.PROCESSING;
  }
};

export type PaymentRefundService = ReturnType<
  typeof createPaymentRefundService
>;
