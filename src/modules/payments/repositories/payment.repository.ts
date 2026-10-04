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

  const getByOrderIdForUpdate = async (orderId: string) => {
    await db.$queryRaw`
      SELECT "id"
      FROM "Payment"
      WHERE "orderId" = ${orderId}
      FOR UPDATE
    `;

    return db.payment.findUnique({
      where: {
        orderId,
      },
    });
  };

  const updatePayment = async (
    paymentId: string,
    data: Prisma.PaymentUpdateInput,
  ) => {
    return db.payment.update({
      where: {
        id: paymentId,
      },
      data,
    });
  };

  const createPaymentAttempt = async (
    data: Prisma.PaymentAttemptCreateInput,
  ) => {
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

  /*
   * ------------------------------------------------------------
   * Webhook
   * ------------------------------------------------------------
   */

  const createWebhookEvent = async (
    data: Prisma.PaymentWebhookEventCreateInput,
  ) => {
    return db.paymentWebhookEvent.create({
      data,
    });
  };

  const getWebhookEvent = async (
    provider: PaymentProvider,
    eventKey: string,
  ) => {
    return db.paymentWebhookEvent.findUnique({
      where: {
        provider_eventKey: {
          provider,
          eventKey,
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

  /*
   * ------------------------------------------------------------
   * Refunds
   * ------------------------------------------------------------
   */

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

  const getRefundByProviderRefundReference = async (
    providerRefundReference: string,
  ) => {
    return db.paymentRefund.findFirst({
      where: {
        providerRefundReference,
      },
    });
  };

  const getRefundedAmount = async (paymentId: string) => {
    const result = await db.paymentRefund.aggregate({
      where: {
        paymentId,
        status: {
          in: ["PENDING", "PROCESSING", "SUCCESS"],
        },
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount ?? 0;
  };

  const getRefundsByPaymentId = async (paymentId: string) => {
    return db.paymentRefund.findMany({
      where: {
        paymentId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  };

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

  return {
    createPayment,
    getById,
    getByOrderId,
    getByOrderIdForUpdate,
    updatePayment,

    createPaymentAttempt,
    getPaymentAttemptById,
    getPaymentAttemptByProviderReference,
    getPaymentAttemptByIdempotencyKey,
    updatePaymentAttempt,

    createWebhookEvent,
    getWebhookEvent,
    markWebhookProcessed,

    createRefund,
    getRefundById,
    getRefundByProviderRefundReference,
    getRefundedAmount,
    getRefundsByPaymentId,
    updateRefund,
  };
};

export type PaymentRepository = ReturnType<typeof createPaymentRepository>;
