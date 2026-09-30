import { OrderStatus } from "@prisma/client";

const allowedTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  [OrderStatus.PENDING]: [
    OrderStatus.CONFIRMED,
    OrderStatus.CANCELLED,
    OrderStatus.EXPIRED,
  ],

  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING],

  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],

  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],

  [OrderStatus.DELIVERED]: [],

  [OrderStatus.CANCELLED]: [],

  [OrderStatus.EXPIRED]: [],
};

export const canTransitionOrderStatus = (
  currentStatus: OrderStatus,
  nextStatus: OrderStatus,
): boolean => {
  return allowedTransitions[currentStatus].includes(nextStatus);
};

export const getAllowedOrderStatusTransitions = (
  currentStatus: OrderStatus,
): readonly OrderStatus[] => {
  return allowedTransitions[currentStatus];
};
