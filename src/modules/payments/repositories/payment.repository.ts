import type { Prisma, PaymentProvider } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";


export const createPaymentRepository = (db: DatabaseClient) => {
  const createPayment = async (data: Prisma.PaymentCreateInput) => {
    return db.payment.create({
      data,
    });
  };

  const getById = async (paymentId: string) => {
    return db.payment.findUnique({
      where: {
        id: paymentId,
      },
    });
  };

  const getByOrderId = async (orderId: string) => {
    return db.payment.findUnique({
      where: {
        orderId,
      },
    });
  };

  
  const updatePayment = async (paymentId: string,data: Prisma.PaymentUpdateInput,) => {
    return db.payment.update({
      where: {
        id: paymentId,
      },
      data,
    });
  };

  const createPaymentAttempt = async ( data: Prisma.PaymentAttemptCreateInput, ) => {
    return db.paymentAttempt.create({
      data,
    });
  };

  const getPaymentAttemptById = async (attemptId: string) => {
    return db.paymentAttempt.findUnique({
      where: {
        id: attemptId,
      },
    });
  };

  const getPaymentAttemptByProviderReference = async (
   provider: PaymentProvider,
    providerReference: string,
  ) => {
    return db.paymentAttempt.findUnique({
      where: {
        provider_providerReference: {
          provider,
          providerReference,
        },
      },
    });
  };

  const updatePaymentAttempt = async (
    attemptId: string,
    data: Prisma.PaymentAttemptUpdateInput,
  ) => {
    return db.paymentAttempt.update({
      where: {
        id: attemptId,
      },
      data,
    });
  };

  const createWebhookEvent = async (
    data: Prisma.PaymentWebhookEventCreateInput,
  ) => {
    return db.paymentWebhookEvent.create({
      data,
    });
  };

  const getWebhookEvent = async (
   provider: PaymentProvider,
    eventId: string,
  ) => {
    return db.paymentWebhookEvent.findUnique({
      where: {
        provider_eventId: {
          provider,
          eventId,
        },
      },
    });
  };

  const markWebhookProcessed = async (
    webhookEventId: string,
    processedAt: Date = new Date(),
  ) => {
    return db.paymentWebhookEvent.update({
      where: {
        id: webhookEventId,
      },
      data: {
        processedAt,
      },
    });
  };

  const createRefund = async (data: Prisma.PaymentRefundCreateInput) => {
    return db.paymentRefund.create({
      data,
    });
  };

  const getRefundById = async (refundId: string) => {
    return db.paymentRefund.findUnique({
      where: {
        id: refundId,
      },
    });
  };

  const getRefundByProviderReference = async (
    providerReference: string,
  ) => {
    return db.paymentRefund.findUnique({
      where: {
        providerReference,
      },
    });
  };

  const getRefundedAmount = async (paymentId: string) => {
  const result = await db.paymentRefund.aggregate({
    where: {
      paymentId,
      status: {
        in: [
          "PENDING",
          "PROCESSING",
          "SUCCESS",
        ],
      },
    },
    _sum: {
      amount: true,
    },
  });

  return result._sum.amount ?? 0;
};

const getRefundsByPaymentId = async (paymentId: string) =>
  db.paymentRefund.findMany({
    where: {
      paymentId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const updateRefund = async (
    refundId: string,
    data: Prisma.PaymentRefundUpdateInput,
  ) => {
    return db.paymentRefund.update({
      where: {
        id: refundId,
      },
      data,
    });
  };

  const getPaymentAttemptByIdempotencyKey = async (
  paymentId: string,
  idempotencyKey: string,
) => {
  return db.paymentAttempt.findUnique({
    where: {
      paymentId_idempotencyKey: {
        paymentId,
        idempotencyKey,
      },
    },
  });
};


  return {
    createPayment,
    getById,
    getByOrderId,
    updatePayment,
    createPaymentAttempt,
    getPaymentAttemptById,
    getPaymentAttemptByProviderReference,
    updatePaymentAttempt,
    createWebhookEvent,
    getWebhookEvent,
    markWebhookProcessed,
    createRefund,
    getRefundById,
    getRefundByProviderReference,
    getRefundedAmount,
    updateRefund,
    getRefundsByPaymentId,
    getPaymentAttemptByIdempotencyKey
  };
};

export type PaymentRepository = ReturnType<typeof createPaymentRepository>;