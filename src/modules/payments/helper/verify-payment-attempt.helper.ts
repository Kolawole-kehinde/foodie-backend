
import {
  PaymentAttemptStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import type { PaymentProviderClient } from "../providers/payment-provider.js";
import { createPaymentRepository } from "../repositories/index.js";
import type { PaymentRepository } from "../repositories/index.js";

type VerifyPaymentAttemptInput = {
  paymentId: string;
  attemptId: string;
  providerReference: string;
};

type VerifyPaymentAttemptDependencies = {
  db: PrismaClient;
  paymentRepository: PaymentRepository;
  provider: PaymentProviderClient;
};

export const createVerifyPaymentAttemptHelper = ({
  db,
  paymentRepository,
  provider,
}: VerifyPaymentAttemptDependencies) => {
  const verifyPaymentAttempt = async ({
    paymentId,
    attemptId,
    providerReference,
  }: VerifyPaymentAttemptInput) => {
    const attempt =
      await paymentRepository.getPaymentAttemptById(attemptId);

    if (!attempt) {
      throw new Error("Payment attempt not found");
    }

    if (attempt.paymentId !== paymentId) {
      throw new Error(
        "Payment attempt does not belong to this payment",
      );
    }

    if (attempt.providerReference !== providerReference) {
      throw new Error(
        "Payment attempt provider reference does not match",
      );
    }

    // Provider errors propagate. A timeout or unknown reference
    // is not, by itself, proof that the payment failed.
    const result = await provider.verifyPayment({
      providerReference,
    });

    // Validate money before accepting provider-reported success.
    if (result.status === "SUCCESS") {
      const expectedAmount = new Prisma.Decimal(
        attempt.amount.toString(),
      );

      const providerAmount = new Prisma.Decimal(result.amount);

      if (expectedAmount.comparedTo(providerAmount) !== 0) {
        throw new Error(
          `Payment amount mismatch. Expected ${expectedAmount.toString()} but provider returned ${providerAmount.toString()}.`,
        );
      }

      const expectedCurrency = attempt.currency.trim().toUpperCase();
      const providerCurrency = result.currency.trim().toUpperCase();

      if (expectedCurrency !== providerCurrency) {
        throw new Error(
          `Payment currency mismatch. Expected ${expectedCurrency} but provider returned ${providerCurrency}.`,
        );
      }
    }

    // UNKNOWN is not a definitive failure. Preserve the current
    // database states and return the provider's result for review.
    if (result.status === "UNKNOWN") {
      return {
        paymentId,
        attemptId,
        provider: result.provider,
        providerReference: result.providerReference,
        amount: result.amount,
        currency: result.currency,
        status: result.status,
        providerStatus: result.providerStatus,
        paidAt: result.paidAt,
        failureReason: result.failureReason,
        metadata: result.metadata,
      };
    }

    await db.$transaction(async (tx) => {
      const repository = createPaymentRepository(tx);

      // Serialize changes to the payment aggregate.
      await repository.getByIdForUpdate(paymentId);

      const [payment, currentAttempt] = await Promise.all([
        repository.getById(paymentId),
        repository.getPaymentAttemptById(attemptId),
      ]);

      if (!payment || !currentAttempt) {
        throw new Error("Payment or payment attempt not found");
      }

      if (currentAttempt.paymentId !== paymentId) {
        throw new Error(
          "Payment attempt does not belong to this payment",
        );
      }

      if (currentAttempt.providerReference !== providerReference) {
        throw new Error(
          "Payment attempt provider reference changed during verification",
        );
      }

      // Never let a stale verification downgrade a successful
      // payment or a completed refund.
      if (
        payment.status === PaymentStatus.SUCCESS ||
        payment.status === PaymentStatus.REFUNDED ||
        payment.status === PaymentStatus.PARTIALLY_REFUNDED ||
        currentAttempt.status === PaymentAttemptStatus.SUCCESS
      ) {
        return;
      }

      const commonAttemptData = {
        providerStatus: result.providerStatus,
        providerReference: result.providerReference,
      };

      switch (result.status) {
        case "SUCCESS": {
          await repository.updatePaymentAttempt(attemptId, {
            ...commonAttemptData,
            status: PaymentAttemptStatus.SUCCESS,
            failureReason: null,
          });

          await repository.updatePayment(paymentId, {
            status: PaymentStatus.SUCCESS,
            failureReason: null,
            failedAt: null,
          });

          break;
        }

        case "PROCESSING": {
          // Do not revive a payment that has already been marked
          // definitively failed, cancelled, or expired.
          if (
            payment.status === PaymentStatus.PENDING ||
            payment.status === PaymentStatus.PROCESSING
          ) {
            await repository.updatePaymentAttempt(attemptId, {
              ...commonAttemptData,
              status: PaymentAttemptStatus.PROCESSING,
            });

            if (payment.status === PaymentStatus.PENDING) {
              await repository.updatePayment(paymentId, {
                status: PaymentStatus.PROCESSING,
              });
            }
          }

          break;
        }

        case "FAILED": {
          if (
            payment.status === PaymentStatus.PENDING ||
            payment.status === PaymentStatus.PROCESSING
          ) {
            await repository.updatePaymentAttempt(attemptId, {
              ...commonAttemptData,
              status: PaymentAttemptStatus.FAILED,
              failureReason: result.failureReason ?? null,
            });

            await repository.updatePayment(paymentId, {
              status: PaymentStatus.FAILED,
              failureReason: result.failureReason ?? null,
            });
          }

          break;
        }

        case "CANCELLED": {
          if (
            payment.status === PaymentStatus.PENDING ||
            payment.status === PaymentStatus.PROCESSING
          ) {
            await repository.updatePaymentAttempt(attemptId, {
              ...commonAttemptData,
              status: PaymentAttemptStatus.CANCELLED,
              failureReason: result.failureReason ?? null,
            });

            await repository.updatePayment(paymentId, {
              status: PaymentStatus.CANCELLED,
              failureReason: result.failureReason ?? null,
            });
          }

          break;
        }

        case "EXPIRED": {
          if (
            payment.status === PaymentStatus.PENDING ||
            payment.status === PaymentStatus.PROCESSING
          ) {
            await repository.updatePaymentAttempt(attemptId, {
              ...commonAttemptData,
              status: PaymentAttemptStatus.EXPIRED,
              failureReason: result.failureReason ?? null,
            });

            await repository.updatePayment(paymentId, {
              status: PaymentStatus.EXPIRED,
              failureReason: result.failureReason ?? null,
            });
          }

          break;
        }
      }
    });

    return {
      paymentId,
      attemptId,
      provider: result.provider,
      providerReference: result.providerReference,
      amount: result.amount,
      currency: result.currency,
      status: result.status,
      providerStatus: result.providerStatus,
      paidAt: result.paidAt,
      failureReason: result.failureReason,
      metadata: result.metadata,
    };
  };

  return {
    verifyPaymentAttempt,
  };
};

export type VerifyPaymentAttemptHelper = ReturnType<
  typeof createVerifyPaymentAttemptHelper
>;
