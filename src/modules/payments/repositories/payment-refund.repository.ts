import {
  Prisma,
  RefundStatus,
} from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

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

  const getRefundById = async (
    refundId: string,
  ) => {
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

  const getRefundedAmount = async (
    paymentId: string,
  ) => {
    const result =
      await db.paymentRefund.aggregate({
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

    return result._sum.amount ?? 0;
  };

  const getRefundsByPaymentId = async (
    paymentId: string,
  ) => {
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
}: {
  staleBefore: Date;
  limit?: number;
}) => {
  return db.paymentRefund.findMany({
    where: {
      status: "PROCESSING",
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
    getRefundByProviderRefundReference,
    getRefundedAmount,
    getRefundsByPaymentId,
    updateRefund,
    getRefundsForReconciliation,
  };
};

export type PaymentRefundRepository =
  ReturnType<
    typeof createPaymentRefundRepository
  >;