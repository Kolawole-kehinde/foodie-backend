import type { Prisma } from "@prisma/client";
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

  const getByIdForUpdate = async (paymentId: string) => {
    await db.$queryRaw`
      SELECT "id"
      FROM "Payment"
      WHERE "id" = ${paymentId}
      FOR UPDATE
    `;

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

  return {
    createPayment,
    getById,
    getByIdForUpdate,
    getByOrderId,
    getByOrderIdForUpdate,
    updatePayment,
  };
};

export type PaymentRepository = ReturnType< typeof createPaymentRepository>;