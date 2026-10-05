import { RefundStatus } from "@prisma/client";

const allowedTransitions: Record<
  RefundStatus,
  readonly RefundStatus[]
> = {
  [RefundStatus.PENDING]: [
    RefundStatus.PROCESSING,
    RefundStatus.CANCELLED,
  ],

  [RefundStatus.PROCESSING]: [
    RefundStatus.SUCCESS,
    RefundStatus.FAILED,
    RefundStatus.CANCELLED,
  ],

  [RefundStatus.SUCCESS]: [],

  [RefundStatus.FAILED]: [],

  [RefundStatus.CANCELLED]: [],
};

export const canTransitionRefundStatus = (
  currentStatus: RefundStatus,
  nextStatus: RefundStatus,
): boolean => {
  return allowedTransitions[currentStatus].includes(
    nextStatus,
  );
};

export const getAllowedRefundStatusTransitions = (
  currentStatus: RefundStatus,
): readonly RefundStatus[] => {
  return allowedTransitions[currentStatus];
};