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

    const attempt = await paymentRepository.getLatestPaymentAttempt(payment.id);

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    if (!attempt.providerReference) {
      throw new Error("Payment attempt does not have a provider reference");
    }

    const provider = paymentProviderRegistry.get(attempt.provider);

    let providerRefundReference = refund.providerRefundReference;

    /*
     * The original refund request may have reached the provider
     * successfully before our application crashed.
     *
     * In that situation the local refund has no
     * providerRefundReference, so we recover it by asking the
     * provider for existing refunds.
     */
    if (!providerRefundReference) {
      const refunds = await provider.listRefunds(attempt.providerReference);

      console.log(
        "[Payments] Provider refunds",
        JSON.stringify(refunds, null, 2),
      );

      const expectedAmount = refund.amount.toFixed(2);

      const expectedCurrency = refund.currency.trim().toUpperCase();

      /*
       * Match primarily by amount + currency.
       *
       * We intentionally do not require providerReference here
       * because Paystack may return the original transaction as
       * a numeric transaction ID rather than our transaction
       * reference.
       *
       * We also prefer an exact providerReference match when
       * available.
       */
      const matchingRefund =
        refunds.refunds.find(
          (providerRefund) =>
            providerRefund.providerReference === attempt.providerReference &&
            providerRefund.amount === expectedAmount &&
            providerRefund.currency.trim().toUpperCase() === expectedCurrency,
        ) ??
        refunds.refunds.find(
          (providerRefund) =>
            providerRefund.amount === expectedAmount &&
            providerRefund.currency.trim().toUpperCase() === expectedCurrency,
        );

      if (!matchingRefund) {
        throw new Error(
          "Unable to find existing provider refund for reconciliation",
        );
      }

      providerRefundReference = matchingRefund.providerRefundReference;

      /*
       * Persist the provider refund reference before verifying it.
       *
       * This makes the next reconciliation attempt independent
       * of the refund-list lookup.
       */
      await db.$transaction(async (tx) => {
        const transactionRepository = createPaymentRepository(tx);

        const refundRecord = await transactionRepository.getRefundById(
          refund.id,
        );

        if (!refundRecord) {
          throw new Error(
            "Refund not found while recovering provider reference",
          );
        }

        if (refundRecord.status !== RefundStatus.PROCESSING) {
          return;
        }

        await transactionRepository.updateRefund(refund.id, {
          providerRefundReference,
          providerStatus: matchingRefund.providerStatus,
        });
      });
    }

    /*
     * At this point we must have a provider refund reference.
     */
    if (!providerRefundReference) {
      throw new Error("Provider refund reference is required for verification");
    }

    const result = await provider.verifyRefund({
      providerRefundReference,
    });

    /*
     * Never trust a provider response blindly.
     * Verify that the refund amount and currency match
     * our local refund.
     */
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
     * The provider may still report PROCESSING.
     *
     * That is not an error. Keep the local refund in
     * PROCESSING and wait for the next reconciliation run.
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
            providerRefundReference ??
            refundRecord.providerRefundReference,

          providerStatus: result.providerStatus,
        });
      });
    }

    /*
     * Only terminal states continue below.
     */
    if (!canTransitionRefundStatus(refund.status, finalStatus)) {
      throw new Error(
        `Invalid refund status transition: ${refund.status} -> ${finalStatus}`,
      );
    }

    const now = new Date();

    return db.$transaction(async (tx) => {
      const transactionRepository = createPaymentRepository(tx);

      const transactionOutboxRepository = createOutboxRepository(tx);

      /*
       * Lock the payment because successful refund
       * reconciliation can change the payment status.
       */
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
       * Another worker/request may have already completed
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

      const refundUpdate: Prisma.PaymentRefundUpdateInput = {
        status: finalStatus,

        providerRefundReference:
          result.providerRefundReference ??
          providerRefundReference ??
          refundRecord.providerRefundReference,

        providerStatus: result.providerStatus,
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
       * A successful refund changes the payment status.
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

          /*
           * Publish the payment refund event through
           * the outbox so the event and database update
           * remain atomic.
           */
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
