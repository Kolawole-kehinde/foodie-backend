import { PaymentStatus } from "@prisma/client";

const allowedTransitions: Record<PaymentStatus, readonly PaymentStatus[]> = {
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
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.REFUNDED,
  ],

  [PaymentStatus.FAILED]: [PaymentStatus.PROCESSING],

  [PaymentStatus.CANCELLED]: [PaymentStatus.PROCESSING],

  [PaymentStatus.EXPIRED]: [PaymentStatus.PROCESSING],

  [PaymentStatus.REFUNDED]: [],
};

export const canTransitionPaymentStatus = (
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus,
): boolean => {
  return allowedTransitions[currentStatus].includes(nextStatus);
};

export const getAllowedPaymentStatusTransitions = (
  currentStatus: PaymentStatus,
): readonly PaymentStatus[] => {
  return allowedTransitions[currentStatus];
};
