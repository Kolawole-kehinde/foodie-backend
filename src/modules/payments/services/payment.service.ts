import { PaymentAttemptStatus, PaymentStatus, Prisma } from "@prisma/client";

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
  const initializePayment = async (input: InitializePaymentServiceInput) => {
    // 1. Prepare payment context.
    const paymentContext = await paymentProcessingService.preparePayment({
      orderId: input.orderId,
      userId: input.userId,
      provider: input.provider,
    });

    // 2. Resolve the payment provider.
    const provider = paymentProviderRegistry.get(input.provider);

    // 3. Create provider operation helpers.
    const initializePaymentAttemptHelper = createInitializePaymentAttemptHelper(
      {
        provider,
        paymentRepository,
        db,
      },
    );

    const verifyPaymentAttemptHelper = createVerifyPaymentAttemptHelper({
      paymentRepository,
      provider,
      db
    });

    // 4. Find an existing payment for the order.
    const existingPayment = await paymentRepository.getByOrderId(input.orderId);

    // 5. Handle an existing payment.
    if (existingPayment) {
      // Always check idempotency first.
      const existingAttempt =
        await paymentRepository.getPaymentAttemptByIdempotencyKey(
          existingPayment.id,
          input.idempotencyKey,
        );

      // 5a. Recover an existing attempt using the same key.
      if (existingAttempt) {
        if (existingAttempt.status === PaymentAttemptStatus.SUCCESS) {
          return {
            paymentId: existingPayment.id,
            attemptId: existingAttempt.id,
            provider: existingAttempt.provider,
            providerReference: existingAttempt.providerReference ?? undefined,
            status: PaymentStatus.SUCCESS,
          };
        }

        if (existingAttempt.status === PaymentAttemptStatus.PROCESSING) {
          return {
            paymentId: existingPayment.id,
            attemptId: existingAttempt.id,
            provider: existingAttempt.provider,
            providerReference: existingAttempt.providerReference ?? undefined,
            status: PaymentStatus.PROCESSING,
          };
        }

        // An INITIATED attempt may have lost its reference
        // because it was created before reference persistence
        // was implemented.
        if (existingAttempt.status === PaymentAttemptStatus.INITIATED) {
          const providerReference =
            existingAttempt.providerReference ?? existingAttempt.id;

          if (!existingAttempt.providerReference) {
            await paymentRepository.updatePaymentAttempt(existingAttempt.id, {
              providerReference,
            });
          }

          // Verify first; do not blindly initialize again.
          return verifyPaymentAttemptHelper.verifyPaymentAttempt({
            paymentId: existingPayment.id,
            attemptId: existingAttempt.id,
            providerReference,
          });
        }

        if (existingAttempt.status === PaymentAttemptStatus.FAILED) {
          throw new Error("This payment attempt has already failed");
        }
      }

      // 5b. A different idempotency key cannot pay an already
      // successful order again.
      if (existingPayment.status === PaymentStatus.SUCCESS) {
        throw new Error("Order has already been paid");
      }

      // 5c. Another attempt is already active.
      if (
        existingPayment.status === PaymentStatus.PROCESSING ||
        existingPayment.status === PaymentStatus.PENDING
      ) {
        throw new Error("A payment is already being processed for this order");
      }

      // 5d. Retry a failed payment with a new idempotency key.
      if (existingPayment.status === PaymentStatus.FAILED) {
        const retryResult = await db.$transaction(async (tx) => {
          const transactionRepository = createPaymentRepository(tx);

          // Lock the payment row before checking or creating attempts.
          const lockedPayment =
            await transactionRepository.getByOrderIdForUpdate(input.orderId);

          if (!lockedPayment) {
            throw new Error("Payment not found");
          }

          // Recheck idempotency after acquiring the lock.
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

          // Recheck payment status while holding the lock.
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

          // Create a new attempt and reset the payment atomically.
          const attempt = await transactionRepository.createPaymentAttempt({
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

          await transactionRepository.updatePayment(lockedPayment.id, {
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

        // Recover an attempt created by a concurrent request.
        if (retryResult.type === "EXISTING") {
          const attempt = retryResult.attempt;

          if (attempt.status === PaymentAttemptStatus.SUCCESS) {
            return {
              paymentId: retryResult.paymentId,
              attemptId: attempt.id,
              provider: attempt.provider,
              providerReference: attempt.providerReference ?? undefined,
              status: PaymentStatus.SUCCESS,
            };
          }

          if (attempt.status === PaymentAttemptStatus.PROCESSING) {
            return {
              paymentId: retryResult.paymentId,
              attemptId: attempt.id,
              provider: attempt.provider,
              providerReference: attempt.providerReference ?? undefined,
              status: PaymentStatus.PROCESSING,
            };
          }

          if (attempt.status === PaymentAttemptStatus.INITIATED) {
            const providerReference = attempt.providerReference ?? attempt.id;

            if (!attempt.providerReference) {
              await paymentRepository.updatePaymentAttempt(attempt.id, {
                providerReference,
              });
            }

            return verifyPaymentAttemptHelper.verifyPaymentAttempt({
              paymentId: retryResult.paymentId,
              attemptId: attempt.id,
              providerReference,
            });
          }

          throw new Error("This payment attempt has already failed");
        }

        // Initialize the new attempt only after the DB transaction
        // has committed.
        return initializePaymentAttemptHelper.initializePaymentAttempt({
          paymentId: retryResult.paymentId,
          attemptId: retryResult.attemptId,
          amount: paymentContext.amount,
          currency: paymentContext.currency,
          customerEmail: paymentContext.customerEmail,
          callbackUrl: input.callbackUrl,
        });
      }
    }

    // 6. No existing payment: create the payment and first attempt
    // atomically.
    try {
      const result = await db.$transaction(async (tx) => {
        const transactionRepository = createPaymentRepository(tx);

        const createdPayment = await transactionRepository.createPayment({
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

        const createdAttempt = await transactionRepository.createPaymentAttempt(
          {
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
          },
        );

        return {
          payment: createdPayment,
          attempt: createdAttempt,
        };
      });

      // 7. Contact Paystack outside the database transaction.
      return initializePaymentAttemptHelper.initializePaymentAttempt({
        paymentId: result.payment.id,
        attemptId: result.attempt.id,
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        customerEmail: paymentContext.customerEmail,
        callbackUrl: input.callbackUrl,
      });
    } catch (error) {
      // 8. If another request created the unique order payment first,
      // re-enter the flow and recover it using the idempotency key.
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

export type PaymentService = ReturnType<typeof createPaymentService>;
