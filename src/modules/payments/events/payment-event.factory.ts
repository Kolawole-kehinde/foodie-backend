import type { PaymentStatus } from "@prisma/client";

export type PaymentEventType =
  | "PAYMENT_PROCESSING"
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_EXPIRED"
  | "PAYMENT_REFUNDED"
  | "PAYMENT_PARTIALLY_REFUNDED";

export type PaymentEvent = {
  type: PaymentEventType;
  paymentId: string;
  orderId: string;
  userId: string;
  provider: string;
  providerReference?: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  occurredAt: Date;
};

type CreatePaymentEventInput = {
  paymentId: string;
  orderId: string;
  userId: string;
  provider: string;
  providerReference?: string;
  amount: string;
  currency: string;
  status: PaymentStatus;
  occurredAt?: Date;
};

export const createPaymentEventFactory = () => {
  const create = ({
    paymentId,
    orderId,
    userId,
    provider,
    providerReference,
    amount,
    currency,
    status,
    occurredAt = new Date(),
  }: CreatePaymentEventInput): PaymentEvent => {
    return {
      type: mapPaymentStatusToEventType(status),
      paymentId,
      orderId,
      userId,
      provider,
      providerReference,
      amount,
      currency,
      status,
      occurredAt,
    };
  };

  return {
    create,
  };
};

const mapPaymentStatusToEventType = (
  status: PaymentStatus,
): PaymentEventType => {
  switch (status) {
    case "PROCESSING":
      return "PAYMENT_PROCESSING";

    case "SUCCESS":
      return "PAYMENT_SUCCEEDED";

    case "FAILED":
      return "PAYMENT_FAILED";

    case "CANCELLED":
      return "PAYMENT_CANCELLED";

    case "EXPIRED":
      return "PAYMENT_EXPIRED";

    case "REFUNDED":
      return "PAYMENT_REFUNDED";

    case "PARTIALLY_REFUNDED":
      return "PAYMENT_PARTIALLY_REFUNDED";

    case "PENDING":
      throw new Error("PENDING payment status cannot create a payment event");
  }
};

export type PaymentEventFactory = ReturnType<typeof createPaymentEventFactory>;
