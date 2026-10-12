
import { Prisma, type PrismaClient } from "@prisma/client";
import type { PaymentProviderRegistry } from "../../providers/payment-provider.registry.js";
import {
  createPaymentRepository,
  type PaymentRepository,
} from "../../repositories/index.js";
import { createOutboxRepository } from "../../../outbox/repositories/outbox.repository.js";
import type { OutboxService } from "../../../outbox/services/outbox.service.js";
import type { PaymentEventFactory } from "../../events/payment-event.factory.js";
import { createPaymentRefundCreationService } from "./payment-refund-creation.service.js";
import { createPaymentRefundProcessingService } from "./payment-refund-processing.service.js";
import { createPaymentRefundReconciliationService } from "./payment-refund-reconciliation.service.js";

type PaymentRefundServiceDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
  outboxService: OutboxService;
  paymentEventFactory: PaymentEventFactory;
};

type CreateRefundInput = {
  paymentId: string;
  userId: string;
  idempotencyKey: string;
  amount?: string;
  reason?: string;
};

export const createPaymentRefundService = ({
  db,
  paymentRepository,
  paymentProviderRegistry,
  outboxService,
  paymentEventFactory,
}: PaymentRefundServiceDependencies) => {
  const creationService = createPaymentRefundCreationService({
    db,
    paymentRepository,
  });

  const processingService = createPaymentRefundProcessingService();

  const reconciliationService = createPaymentRefundReconciliationService({
    db,
    paymentRepository,
    paymentProviderRegistry,
    outboxService,
    paymentEventFactory,
  });

  const createRefund = async ({
    paymentId,
    userId,
    idempotencyKey,
    amount,
    reason,
  }: CreateRefundInput) => {
    const { payment, refund, refundAmount } =
      await creationService.createRefundRecord({
        paymentId,
        userId,
        idempotencyKey,
        amount,
        reason,
      });

    const attempt = await paymentRepository.getLatestPaymentAttempt(payment.id);

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    if (!attempt.providerReference) {
      throw new Error("Payment attempt does not have a provider reference");
    }

    const provider = paymentProviderRegistry.get(attempt.provider);

    // Pass the local refund ID so an uncertain provider request can be recovered.
    const { result, finalStatus } = await processingService.processRefund({
      provider,
      refundId: refund.id,
      paymentId: payment.id,
      providerReference: attempt.providerReference,
      amount: refundAmount,
      currency: payment.currency,
      reason,
    });

    const now = new Date();

    return db.$transaction(async (tx) => {
      const transactionRepository = createPaymentRepository(tx);
      const transactionOutboxRepository = createOutboxRepository(tx);

      const lockedPayment = await transactionRepository.getByIdForUpdate(
        payment.id,
      );

      if (!lockedPayment) {
        throw new Error("Payment not found during refund processing");
      }

      const refundRecord = await transactionRepository.getRefundById(refund.id);

      if (!refundRecord) {
        throw new Error("Refund not found during refund processing");
      }

      // A concurrent worker may already have finalized this refund.
      if (refundRecord.status !== "PROCESSING") {
        return refundRecord;
      }

      const refundUpdate: Prisma.PaymentRefundUpdateInput = {
        status: finalStatus,
        providerRefundReference: result.providerRefundReference,
        providerStatus: result.providerStatus,
      };

      if (finalStatus === "SUCCESS") {
        refundUpdate.completedAt = now;
        refundUpdate.failureReason = null;
      }

      if (finalStatus === "FAILED") {
        refundUpdate.failureReason = result.failureReason ?? "Refund failed";
      }

      if (finalStatus === "CANCELLED") {
        refundUpdate.failureReason =
          result.failureReason ?? "Refund cancelled";
      }

      const updatedRefund = await transactionRepository.updateRefund(
        refund.id,
        refundUpdate,
      );

      if (finalStatus !== "SUCCESS") {
        return updatedRefund;
      }

      const totalRefunded = await transactionRepository.getRefundedAmount(
        payment.id,
      );

      const isFullRefund =
        Number(totalRefunded) >= Number(lockedPayment.amount);

      const nextPaymentStatus = isFullRefund
        ? "REFUNDED"
        : "PARTIALLY_REFUNDED";

      if (lockedPayment.status === nextPaymentStatus) {
        return updatedRefund;
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

      // Keep the payment update and event creation in the same transaction.
      await outboxService.createEvent({
        event: paymentEvent,
        repository: transactionOutboxRepository,
      });

      return updatedRefund;
    });
  };

  return {
    createRefund,
    reconcileRefund: reconciliationService.reconcileRefund,
  };
};

export type PaymentRefundService = ReturnType<
  typeof createPaymentRefundService
>;
