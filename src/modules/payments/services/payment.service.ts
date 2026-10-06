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

const isUniqueConstraintError = (error: unknown): boolean => {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
};

export const createPaymentService = ({
  db,
  paymentRepository,
  paymentProviderRegistry,
  paymentProcessingService,
}: PaymentServiceDependencies) => {
  const initializePayment = async (
    input: InitializePaymentServiceInput,
  ) => {
    /*
     * ------------------------------------------------------------
     * 1. Prepare payment context
     * ------------------------------------------------------------
     */
    const paymentContext =
      await paymentProcessingService.preparePayment({
        orderId: input.orderId,
        userId: input.userId,
        provider: input.provider,
      });

    /*
     * ------------------------------------------------------------
     * 2. Resolve provider
     * ------------------------------------------------------------
     */
    const provider = paymentProviderRegistry.get(input.provider);

    /*
     * ------------------------------------------------------------
     * 3. Create provider operation helpers
     * ------------------------------------------------------------
     */
    const initializePaymentAttemptHelper =
      createInitializePaymentAttemptHelper({
        provider,
        paymentRepository
      });

    const verifyPaymentAttemptHelper =
      createVerifyPaymentAttemptHelper({
        paymentRepository,
        provider,
      });

    /*
     * ------------------------------------------------------------
     * 4. Find existing Payment
     * ------------------------------------------------------------
     */
    const existingPayment =
      await paymentRepository.getByOrderId(input.orderId);

    /*
     * ------------------------------------------------------------
     * 5. Existing Payment
     * ------------------------------------------------------------
     */
    if (existingPayment) {
      /*
       * Always check idempotency first.
       */
      const existingAttempt =
        await paymentRepository.getPaymentAttemptByIdempotencyKey(
          existingPayment.id,
          input.idempotencyKey,
        );

      /*
       * ----------------------------------------------------------
       * Existing attempt for the same idempotency key
       * ----------------------------------------------------------
       */
      if (existingAttempt) {
        /*
         * Attempt already succeeded.
         */
        if (
          existingAttempt.status ===
          PaymentAttemptStatus.SUCCESS
        ) {
          return {
            paymentId: existingPayment.id,
            attemptId: existingAttempt.id,
            provider: existingAttempt.provider,
            providerReference:
              existingAttempt.providerReference ?? undefined,
            status: PaymentStatus.SUCCESS,
          };
        }

        /*
         * Attempt is currently processing.
         */
        if (
          existingAttempt.status ===
          PaymentAttemptStatus.PROCESSING
        ) {
          return {
            paymentId: existingPayment.id,
            attemptId: existingAttempt.id,
            provider: existingAttempt.provider,
            providerReference:
              existingAttempt.providerReference ?? undefined,
            status: PaymentStatus.PROCESSING,
          };
        }

        /*
         * Attempt is INITIATED.
         *
         * If a provider reference exists, verify the transaction.
         */
        if (
          existingAttempt.status ===
          PaymentAttemptStatus.INITIATED
        ) {
          if (existingAttempt.providerReference) {
            return verifyPaymentAttemptHelper.verifyPaymentAttempt({
              paymentId: existingPayment.id,
              attemptId: existingAttempt.id,
              providerReference:
                existingAttempt.providerReference,
            });
          }

          /*
           * We cannot safely initialize again because the previous
           * request may already have reached the provider.
           */
          throw new Error(
            "Payment initialization outcome is still being determined",
          );
        }

        /*
         * Same idempotency key was already used by a failed attempt.
         */
        if (
          existingAttempt.status ===
          PaymentAttemptStatus.FAILED
        ) {
          throw new Error(
            "This payment attempt has already failed",
          );
        }
      }

      /*
       * ----------------------------------------------------------
       * Different idempotency key
       * ----------------------------------------------------------
       */

      /*
       * Payment already succeeded.
       */
      if (existingPayment.status === PaymentStatus.SUCCESS) {
        throw new Error("Order has already been paid");
      }

      /*
       * Payment is already being processed.
       */
      if (
        existingPayment.status === PaymentStatus.PROCESSING ||
        existingPayment.status === PaymentStatus.PENDING
      ) {
        throw new Error(
          "A payment is already being processed for this order",
        );
      }

      /*
       * ----------------------------------------------------------
       * Previous Payment failed.
       *
       * A new idempotency key means this is a legitimate retry.
       * The Payment row is locked before creating the attempt.
       * ----------------------------------------------------------
       */
      if (existingPayment.status === PaymentStatus.FAILED) {
        const retryResult = await db.$transaction(async (tx) => {
          const transactionRepository =
            createPaymentRepository(tx);

          /*
           * Lock the Payment row.
           */
          const lockedPayment =
            await transactionRepository.getByOrderIdForUpdate(
              input.orderId,
            );

          if (!lockedPayment) {
            throw new Error("Payment not found");
          }

          /*
           * IMPORTANT:
           *
           * Check the idempotency key AGAIN after acquiring the
           * lock.
           *
           * This handles:
           *
           * Request A → creates attempt with key-A
           * Request B → waits for Payment lock
           * Request A → commits
           * Request B → acquires lock
           *
           * Request B must recover key-A instead of creating
           * another attempt or incorrectly throwing PENDING.
           */
          const lockedExistingAttempt =
            await transactionRepository.getPaymentAttemptByIdempotencyKey(
              lockedPayment.id,
              input.idempotencyKey,
            );

          if (lockedExistingAttempt) {
            return {
              type: "EXISTING" as const,
              paymentId: lockedPayment.id,
              attempt: lockedExistingAttempt,
            };
          }

          /*
           * Re-check Payment status AFTER acquiring the lock.
           */
          if (lockedPayment.status !== PaymentStatus.FAILED) {
            if (
              lockedPayment.status === PaymentStatus.PENDING ||
              lockedPayment.status ===
                PaymentStatus.PROCESSING
            ) {
              throw new Error(
                "A payment is already being processed for this order",
              );
            }

            if (
              lockedPayment.status === PaymentStatus.SUCCESS
            ) {
              throw new Error("Order has already been paid");
            }

            throw new Error(
              `Payment cannot be retried in its current status: ${lockedPayment.status}`,
            );
          }

          /*
           * Create the new PaymentAttempt and reset the Payment
           * aggregate in the same transaction.
           */
          const attempt =
            await transactionRepository.createPaymentAttempt({
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

          await transactionRepository.updatePayment(
            lockedPayment.id,
            {
              status: PaymentStatus.PENDING,
              failureReason: null,
              failedAt: null,
            },
          );

          return {
            type: "CREATED" as const,
            paymentId: lockedPayment.id,
            attemptId: attempt.id,
          };
        });

        /*
         * --------------------------------------------------------
         * Recover an existing attempt created by a concurrent
         * request using the same idempotency key.
         * --------------------------------------------------------
         */
        if (retryResult.type === "EXISTING") {
          const attempt = retryResult.attempt;

          if (
            attempt.status === PaymentAttemptStatus.SUCCESS
          ) {
            return {
              paymentId: retryResult.paymentId,
              attemptId: attempt.id,
              provider: attempt.provider,
              providerReference:
                attempt.providerReference ?? undefined,
              status: PaymentStatus.SUCCESS,
            };
          }

          if (
            attempt.status === PaymentAttemptStatus.PROCESSING
          ) {
            return {
              paymentId: retryResult.paymentId,
              attemptId: attempt.id,
              provider: attempt.provider,
              providerReference:
                attempt.providerReference ?? undefined,
              status: PaymentStatus.PROCESSING,
            };
          }

          if (
            attempt.status === PaymentAttemptStatus.INITIATED
          ) {
            if (!attempt.providerReference) {
              throw new Error(
                "Payment initialization outcome is still being determined",
              );
            }

            return verifyPaymentAttemptHelper.verifyPaymentAttempt(
              {
                paymentId: retryResult.paymentId,
                attemptId: attempt.id,
                providerReference:
                  attempt.providerReference,
              },
            );
          }

          throw new Error(
            "This payment attempt has already failed",
          );
        }

        /*
         * --------------------------------------------------------
         * Call external provider AFTER the transaction commits.
         * --------------------------------------------------------
         */
        return initializePaymentAttemptHelper.initializePaymentAttempt(
          {
            paymentId: retryResult.paymentId,
            attemptId: retryResult.attemptId,
            amount: paymentContext.amount,
            currency: paymentContext.currency,
            customerEmail: paymentContext.customerEmail,
            callbackUrl: input.callbackUrl,
          },
        );
      }
    }

    /*
     * ------------------------------------------------------------
     * 6. No existing Payment
     * ------------------------------------------------------------
     *
     * Create Payment + first PaymentAttempt atomically.
     */
    try {
      const result = await db.$transaction(async (tx) => {
        const transactionRepository =
          createPaymentRepository(tx);

        /*
         * Create Payment.
         */
        const createdPayment =
          await transactionRepository.createPayment({
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

        /*
         * Create first PaymentAttempt.
         */
        const createdAttempt =
          await transactionRepository.createPaymentAttempt({
            payment: {
              connect: {
                id: createdPayment.id,
              },
            },
            provider: input.provider,
            amount: paymentContext.amount,
            currency: paymentContext.currency,
            status: PaymentAttemptStatus.INITIATED,
            idempotencyKey: input.idempotencyKey,
          });

        return {
          payment: createdPayment,
          attempt: createdAttempt,
        };
      });

      /*
       * ----------------------------------------------------------
       * 7. Call external provider OUTSIDE the DB transaction.
       * ----------------------------------------------------------
       */
      return initializePaymentAttemptHelper.initializePaymentAttempt(
        {
          paymentId: result.payment.id,
          attemptId: result.attempt.id,
          amount: paymentContext.amount,
          currency: paymentContext.currency,
          customerEmail: paymentContext.customerEmail,
          callbackUrl: input.callbackUrl,
        },
      );
    } catch (error) {
      /*
       * ----------------------------------------------------------
       * 8. Concurrent Payment creation
       * ----------------------------------------------------------
       *
       * Payment.orderId is unique.
       *
       * If another request created the Payment first, retry the
       * initialization flow.
       */
      if (isUniqueConstraintError(error)) {
        return initializePayment(input);
      }

      throw error;
    }
  };

  return {
    initializePayment,
  };
};

export type PaymentService = ReturnType<
  typeof createPaymentService
>;