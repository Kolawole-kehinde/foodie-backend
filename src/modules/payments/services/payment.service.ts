import {
  PaymentAttemptStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";

import { createInitializePaymentAttemptHelper } from "../helper/initialize-payment-attempt.helper.js";
import { createVerifyPaymentAttemptHelper } from "../helper/verify-payment-attempt.helper.js";
import { createPaymentRepository } from "../repositories/index.js";

import type {
  InitializePaymentServiceInput,
  PaymentServiceDependencies,
} from "../types/payment.types.js";

export const createPaymentService = ({
  db,
  paymentRepository,
  paymentProviderRegistry,
  paymentProcessingService,
}: PaymentServiceDependencies) => {
  // Prepare the payment context and provider helpers.
  const initializePayment = async (
    input: InitializePaymentServiceInput,
  ) => {
    const paymentContext = await paymentProcessingService.preparePayment({
      orderId: input.orderId,
      userId: input.userId,
      provider: input.provider,
    });

    const provider = paymentProviderRegistry.get(input.provider);

    const initializeAttempt = createInitializePaymentAttemptHelper({
      provider,
      paymentRepository,
      db,
    });

    const verifyAttempt = createVerifyPaymentAttemptHelper({
      paymentRepository,
      provider,
      db,
    });

    // Recover an attempt using its existing idempotency key.
    const recoverAttempt = async (
      paymentId: string,
      attempt: NonNullable<
        Awaited<
          ReturnType<
            typeof paymentRepository.getPaymentAttemptByIdempotencyKey
          >
        >
      >,
    ) => {
      if (attempt.status === PaymentAttemptStatus.SUCCESS) {
        return {
          paymentId,
          attemptId: attempt.id,
          provider: attempt.provider,
          providerReference: attempt.providerReference ?? undefined,
          status: PaymentStatus.SUCCESS,
        };
      }

      if (attempt.status === PaymentAttemptStatus.PROCESSING) {
        return {
          paymentId,
          attemptId: attempt.id,
          provider: attempt.provider,
          providerReference: attempt.providerReference ?? undefined,
          status: PaymentStatus.PROCESSING,
        };
      }

      if (attempt.status === PaymentAttemptStatus.INITIATED) {
        const providerReference =
          attempt.providerReference ?? attempt.id;

        if (!attempt.providerReference) {
          await paymentRepository.updatePaymentAttempt(attempt.id, {
            providerReference,
          });
        }

        return verifyAttempt.verifyPaymentAttempt({
          paymentId,
          attemptId: attempt.id,
          providerReference,
        });
      }

      if (attempt.status === PaymentAttemptStatus.FAILED) {
        throw new Error("This payment attempt has already failed");
      }

      throw new Error(
        `Payment attempt cannot be reused in its current status: ${attempt.status}`,
      );
    };

    // Handle payments that already exist for this order.
    const handleExistingPayment = async (
      payment: NonNullable<
        Awaited<ReturnType<typeof paymentRepository.getByOrderId>>
      >,
    ) => {
      const existingAttempt =
        await paymentRepository.getPaymentAttemptByIdempotencyKey(
          payment.id,
          input.idempotencyKey,
        );

      if (existingAttempt) {
        return recoverAttempt(payment.id, existingAttempt);
      }

      if (payment.status === PaymentStatus.SUCCESS) {
        throw new Error("Order has already been paid");
      }

      if (
        payment.status === PaymentStatus.PROCESSING ||
        payment.status === PaymentStatus.PENDING
      ) {
        throw new Error(
          "A payment is already being processed for this order",
        );
      }

      if (payment.status !== PaymentStatus.FAILED) {
        throw new Error(
          `Payment cannot be initialized in its current status: ${payment.status}`,
        );
      }

      // Lock the failed payment before creating a retry attempt.
      const retryResult = await db.$transaction(async (tx) => {
        const repository = createPaymentRepository(tx);

        const lockedPayment =
          await repository.getByOrderIdForUpdate(input.orderId);

        if (!lockedPayment) {
          throw new Error("Payment not found");
        }

        const lockedAttempt =
          await repository.getPaymentAttemptByIdempotencyKey(
            lockedPayment.id,
            input.idempotencyKey,
          );

        if (lockedAttempt) {
          return {
            type: "EXISTING" as const,
            paymentId: lockedPayment.id,
            attempt: lockedAttempt,
          };
        }

        if (lockedPayment.status !== PaymentStatus.FAILED) {
          if (
            lockedPayment.status === PaymentStatus.PENDING ||
            lockedPayment.status === PaymentStatus.PROCESSING
          ) {
            throw new Error(
              "A payment is already being processed for this order",
            );
          }

          if (lockedPayment.status === PaymentStatus.SUCCESS) {
            throw new Error("Order has already been paid");
          }

          throw new Error(
            `Payment cannot be retried in its current status: ${lockedPayment.status}`,
          );
        }

        // Create the attempt and reset the payment atomically.
        const attempt = await repository.createPaymentAttempt({
          payment: {
            connect: {
              id: lockedPayment.id,
            },
          },
          provider: input.provider,
          amount: paymentContext.amount,
          currency: paymentContext.currency,
          status: PaymentAttemptStatus.INITIATED,
          idempotencyKey: input.idempotencyKey,
        });

        await repository.updatePayment(lockedPayment.id, {
          status: PaymentStatus.PENDING,
          failureReason: null,
          failedAt: null,
        });

        return {
          type: "CREATED" as const,
          paymentId: lockedPayment.id,
          attemptId: attempt.id,
        };
      });

      if (retryResult.type === "EXISTING") {
        return recoverAttempt(
          retryResult.paymentId,
          retryResult.attempt,
        );
      }

      // Call the provider only after the transaction commits.
      return initializeAttempt.initializePaymentAttempt({
        paymentId: retryResult.paymentId,
        attemptId: retryResult.attemptId,
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        customerEmail: paymentContext.customerEmail,
        callbackUrl: input.callbackUrl,
      });
    };

    const existingPayment = await paymentRepository.getByOrderId(
      input.orderId,
    );

    if (existingPayment) {
      return handleExistingPayment(existingPayment);
    }

    // Create the initial payment and attempt in one transaction.
    try {
      const result = await db.$transaction(async (tx) => {
        const repository = createPaymentRepository(tx);

        const payment = await repository.createPayment({
          order: {
            connect: {
              id: paymentContext.orderId,
            },
          },
          user: {
            connect: {
              id: paymentContext.userId,
            },
          },
          amount: paymentContext.amount,
          currency: paymentContext.currency,
          status: PaymentStatus.PENDING,
        });

        const attempt = await repository.createPaymentAttempt({
          payment: {
            connect: {
              id: payment.id,
            },
          },
          provider: input.provider,
          amount: paymentContext.amount,
          currency: paymentContext.currency,
          status: PaymentAttemptStatus.INITIATED,
          idempotencyKey: input.idempotencyKey,
        });

        return { payment, attempt };
      });

      // Initialize the provider after the database transaction commits.
      return initializeAttempt.initializePaymentAttempt({
        paymentId: result.payment.id,
        attemptId: result.attempt.id,
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        customerEmail: paymentContext.customerEmail,
        callbackUrl: input.callbackUrl,
      });
    } catch (error) {
      // Recover a concurrent creation only when its payment exists.
      if (!isUniqueConstraintError(error)) {
        throw error;
      }

      const payment = await paymentRepository.getByOrderId(input.orderId);

      if (!payment) {
        throw error;
      }

      return handleExistingPayment(payment);
    }
  };

  return { initializePayment };
};

// Detect unique-constraint conflicts from Prisma.
const isUniqueConstraintError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
};

export type PaymentService = ReturnType<typeof createPaymentService>;