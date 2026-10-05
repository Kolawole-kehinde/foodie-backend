import crypto from "node:crypto";

import type { PaymentStatus } from "@prisma/client";

import {
  EVENT_TYPES,
  type PaymentEvent,
  type PaymentEventData,
} from "../../../shared/events/event.types.js";

type CreatePaymentEventInput = PaymentEventData & {
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
      eventId: crypto.randomUUID(),
      eventType: mapPaymentStatusToEventType(status),
      occurredAt: occurredAt.toISOString(),
      aggregateType: "payment",
      aggregateId: paymentId,
      data: {
        paymentId,
        orderId,
        userId,
        provider,
        providerReference,
        amount,
        currency,
        status,
      },
    };
  };

  return {
    create,
  };
};

const mapPaymentStatusToEventType = (
  status: PaymentStatus,
): PaymentEvent["eventType"] => {
  switch (status) {
    case "PROCESSING":
      return EVENT_TYPES.PAYMENT_PROCESSING;

    case "SUCCESS":
      return EVENT_TYPES.PAYMENT_SUCCEEDED;

    case "FAILED":
      return EVENT_TYPES.PAYMENT_FAILED;

    case "CANCELLED":
      return EVENT_TYPES.PAYMENT_CANCELLED;

    case "EXPIRED":
      return EVENT_TYPES.PAYMENT_EXPIRED;

    case "REFUNDED":
      return EVENT_TYPES.PAYMENT_REFUNDED;

    case "PARTIALLY_REFUNDED":
      return EVENT_TYPES.PAYMENT_PARTIALLY_REFUNDED;

    case "PENDING":
      throw new Error(
        "PENDING payment status cannot create a payment event",
      );
  }
};

export type PaymentEventFactory =
  ReturnType<typeof createPaymentEventFactory>;