import { PaymentStatus } from "@prisma/client";

const allowedTransitions: Record<
  PaymentStatus,
  readonly PaymentStatus[]
> = {
  [PaymentStatus.PENDING]: [
    PaymentStatus.PROCESSING,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
  ],

  [PaymentStatus.PROCESSING]: [
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
  ],

  [PaymentStatus.SUCCESS]: [
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ],

  [PaymentStatus.PARTIALLY_REFUNDED]: [
    PaymentStatus.REFUNDED,
  ],

  // Retrying a failed payment returns it to PENDING with a new attempt.
  [PaymentStatus.FAILED]: [PaymentStatus.PENDING],

  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.EXPIRED]: [],
  [PaymentStatus.REFUNDED]: [],
};

export const canTransitionPaymentStatus = (
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus,
): boolean => {
  // An unchanged status is idempotent, not a new transition.
  return (
    currentStatus === nextStatus ||
    allowedTransitions[currentStatus].includes(nextStatus)
  );
};

export const getAllowedPaymentStatusTransitions = (
  currentStatus: PaymentStatus,
): readonly PaymentStatus[] => {
  return allowedTransitions[currentStatus];
};