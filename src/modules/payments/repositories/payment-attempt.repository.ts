import type {
  Prisma,
  PaymentProvider,
} from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createPaymentAttemptRepository = (
  db: DatabaseClient,
) => {
  const createPaymentAttempt = async (
    data: Prisma.PaymentAttemptCreateInput,
  ) => {
    return db.paymentAttempt.create({
      data,
    });
  };

  const getPaymentAttemptById = async (
    attemptId: string,
  ) => {
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

  const getLatestPaymentAttempt = async (
    paymentId: string,
  ) => {
    return db.paymentAttempt.findFirst({
      where: {
        paymentId,
      },
      orderBy: {
        createdAt: "desc",
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

  return {
    createPaymentAttempt,
    getPaymentAttemptById,
    getPaymentAttemptByProviderReference,
    getPaymentAttemptByIdempotencyKey,
    getLatestPaymentAttempt,
    updatePaymentAttempt,
  };
};

export type PaymentAttemptRepository = ReturnType<
  typeof createPaymentAttemptRepository
>;