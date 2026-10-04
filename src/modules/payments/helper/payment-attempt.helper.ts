import {
  PaymentAttemptStatus,
  type PaymentProvider,
} from "@prisma/client";
import type { PaymentRepository } from "../repositories/payment.repository.js";

type CreateOrGetPaymentAttemptInput = {
  paymentId: string;
  provider: PaymentProvider;
  amount: string;
  currency: string;
  idempotencyKey: string;
};

type CreateOrGetPaymentAttemptDependencies = {
  paymentRepository: PaymentRepository;
};

export const createPaymentAttemptHelper = ({
  paymentRepository,
}: CreateOrGetPaymentAttemptDependencies) => {
  const createOrGetPaymentAttempt = async ({
    paymentId,
    provider,
    amount,
    currency,
    idempotencyKey,
  }: CreateOrGetPaymentAttemptInput) => {
    const existingAttempt =
      await paymentRepository.getPaymentAttemptByIdempotencyKey(
        paymentId,
        idempotencyKey,
      );

    if (existingAttempt) {
      return {
        attempt: existingAttempt,
        isExisting: true,
      };
    }

    try {
      const attempt = await paymentRepository.createPaymentAttempt({
        payment: {
          connect: {
            id: paymentId,
          },
        },
        provider,
        amount,
        currency,
        status: PaymentAttemptStatus.INITIATED,
        idempotencyKey,
      });

      return {
        attempt,
        isExisting: false,
      };
    } catch (error) {
      /*
       * Another concurrent request may have created the same
       * attempt after our lookup but before our INSERT.
       */
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const attempt =
          await paymentRepository.getPaymentAttemptByIdempotencyKey(
            paymentId,
            idempotencyKey,
          );

        if (attempt) {
          return {
            attempt,
            isExisting: true,
          };
        }
      }

      throw error;
    }
  };

  return {
    createOrGetPaymentAttempt,
  };
};

export type PaymentAttemptHelper = ReturnType<
  typeof createPaymentAttemptHelper
>;