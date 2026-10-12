
import { Prisma, RefundStatus } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

type GetRefundsForReconciliationInput = {
  staleBefore: Date;
  limit?: number;
};

export const createPaymentRefundRepository = (
  db: DatabaseClient,
) => {
  const createRefund = async (
    data: Prisma.PaymentRefundCreateInput,
  ) => {
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

  const getRefundByIdempotencyKey = async (
    paymentId: string,
    idempotencyKey: string,
  ) => {
    return db.paymentRefund.findUnique({
      where: {
        paymentId_idempotencyKey: {
          paymentId,
          idempotencyKey,
        },
      },
    });
  };

  const getRefundByProviderRefundReference = async (
    providerRefundReference: string,
  ) => {
    return db.paymentRefund.findUnique({
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
          in: [
            RefundStatus.PENDING,
            RefundStatus.PROCESSING,
            RefundStatus.SUCCESS,
          ],
        },
      },
      _sum: {
        amount: true,
      },
    });

    return result._sum.amount ?? new Prisma.Decimal(0);
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

  const getRefundsForReconciliation = async ({
    staleBefore,
    limit = 50,
  }: GetRefundsForReconciliationInput) => {
    return db.paymentRefund.findMany({
      where: {
        status: RefundStatus.PROCESSING,
        updatedAt: {
          lt: staleBefore,
        },
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: limit,
    });
  };

  return {
    createRefund,
    getRefundById,
    getRefundByIdempotencyKey,
    getRefundByProviderRefundReference,
    getRefundedAmount,
    getRefundsByPaymentId,
    updateRefund,
    getRefundsForReconciliation,
  };
};

export type PaymentRefundRepository = ReturnType<
  typeof createPaymentRefundRepository
>;
