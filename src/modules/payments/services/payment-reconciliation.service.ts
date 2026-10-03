import { PaymentAttemptStatus, PaymentStatus } from "@prisma/client";
import type { PaymentProviderRegistry } from "../providers/payment-provider.registry.js";
import type { PaymentRepository } from "../repositories/payment.repository.js";
import { canTransitionPaymentStatus } from "../policies/payment-status-transition.policy.js";


type ReconcilePaymentInput = {
  paymentId: string;
};

type PaymentReconciliationServiceDependencies = {
  paymentRepository: PaymentRepository;
  paymentProviderRegistry: PaymentProviderRegistry;
};

export const createPaymentReconciliationService = ({
  paymentRepository,
  paymentProviderRegistry,
}: PaymentReconciliationServiceDependencies) => {
  const reconcilePayment = async ({ paymentId }: ReconcilePaymentInput) => {
    // 1. Find our payment
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    // 2. A provider reference is required for verification
    if (!payment.providerReference) {
      throw new Error("Payment does not have a provider reference");
    }

    // 3. Resolve the configured provider
    const provider = paymentProviderRegistry.getProvider(payment.provider);

    // 4. Ask the provider for the authoritative payment status
    const result = await provider.verifyPayment({
      providerReference: payment.providerReference,
    });

    // 5. Validate the provider response
    if (result.amount !== payment.amount.toFixed(2)) {
      throw new Error("Provider payment amount does not match stored payment");
    }

    if (result.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      throw new Error(
        "Provider payment currency does not match stored payment",
      );
    }

    // 6. Map provider status to our internal status
    const nextStatus = mapProviderStatusToPaymentStatus(result.status);

    // 7. Nothing to change
    if (payment.status === nextStatus) {
      return {
        paymentId: payment.id,
        previousStatus: payment.status,
        status: payment.status,
        changed: false,
      };
    }

    // 8. Protect the payment state machine
    if (!canTransitionPaymentStatus(payment.status, nextStatus)) {
      throw new Error(
        `Invalid payment status transition: ${payment.status} -> ${nextStatus}`,
      );
    }

    const now = new Date();

    // 9. Prepare payment update
    const paymentUpdate: {
      status: PaymentStatus;
      paidAt?: Date;
      failedAt?: Date;
      failureReason?: string;
    } = {
      status: nextStatus,
    };

    if (nextStatus === PaymentStatus.SUCCESS) {
      paymentUpdate.paidAt = now;
      paymentUpdate.failedAt = undefined;
      paymentUpdate.failureReason = undefined;
    }

    if (nextStatus === PaymentStatus.FAILED) {
      paymentUpdate.failedAt = now;
      paymentUpdate.failureReason =
        result.failureReason ?? "Payment verification failed";
    }

    // 10. Update payment
    await paymentRepository.updatePayment(payment.id, paymentUpdate);

    // 11. Update corresponding payment attempt
    const attempt =
      await paymentRepository.getPaymentAttemptByProviderReference(
        payment.provider,
        payment.providerReference,
      );

    if (attempt) {
      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: mapPaymentStatusToAttemptStatus(nextStatus),
        completedAt: isTerminalPaymentStatus(nextStatus) ? now : undefined,
        failureReason:
          nextStatus === PaymentStatus.FAILED
            ? result.failureReason
            : undefined,
      });
    }

    return {
      paymentId: payment.id,
      previousStatus: payment.status,
      status: nextStatus,
      changed: true,
    };
  };

  return {
    reconcilePayment,
  };
};

const mapProviderStatusToPaymentStatus = (
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED",
): PaymentStatus => {
  switch (status) {
    case "SUCCESS":
      return PaymentStatus.SUCCESS;

    case "FAILED":
      return PaymentStatus.FAILED;

    case "CANCELLED":
      return PaymentStatus.CANCELLED;

    case "PROCESSING":
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

const isTerminalPaymentStatus = (status: PaymentStatus): boolean => {
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
