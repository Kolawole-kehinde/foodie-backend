import { PaymentAttemptStatus, PaymentStatus, Prisma } from "@prisma/client";
import { createPaymentRepository } from "../repositories/payment.repository.js";
import { PaymentProviderError } from "../errors/payment-provider.error.js";
import type {
  InitializePaymentServiceInput,
  PaymentServiceDependencies,
} from "../types/payment.types.js";
import { createPaymentAttemptHelper } from "../helper/payment-attempt.helper.js";

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
  const paymentAttemptHelper = createPaymentAttemptHelper({
    paymentRepository,
  });

  const initializePayment = async (input: InitializePaymentServiceInput) => {
    // 1. Prepare trusted payment context from the order.
    const paymentContext = await paymentProcessingService.preparePayment({
      orderId: input.orderId,
      userId: input.userId,
      provider: input.provider,
    });

    // 2. Resolve the configured provider before creating
    // any payment records.
    const provider = paymentProviderRegistry.get(input.provider);

    // 3. Check whether a payment already exists for this order.
    //
    // This handles the normal case. The database unique constraint
    // on Payment.orderId protects us from concurrent first attempts.
    const existingPayment = await paymentRepository.getByOrderId(input.orderId);

    if (existingPayment) {
      if (existingPayment.status === PaymentStatus.SUCCESS) {
        throw new Error("Order has already been paid");
      }

      if (
        existingPayment.status === PaymentStatus.PROCESSING ||
        existingPayment.status === PaymentStatus.PENDING
      ) {
        throw new Error("A payment already exists for this order");
      }
    }

    let payment;
    let attempt;

    // 4. Handle an existing failed payment.
    //
    // A Payment represents the payment aggregate for the order.
    // A retry creates a new PaymentAttempt under that Payment.
    if (existingPayment?.status === PaymentStatus.FAILED) {
      payment = existingPayment;

   const result =
  await paymentAttemptHelper.createOrGetPaymentAttempt({
    paymentId: payment.id,
    provider: input.provider,
    amount: paymentContext.amount,
    currency: paymentContext.currency,
    idempotencyKey: input.idempotencyKey,
  });

  attempt = result.attempt;

  if (result.isExisting) {
    /*
     * The same idempotency key has already been processed.
     *
     * Do not call the provider again.
     */
    if (
      attempt.status === PaymentAttemptStatus.PROCESSING ||
      attempt.status === PaymentAttemptStatus.SUCCESS
    ) {
      return {
        paymentId: payment.id,
        attemptId: attempt.id,
        provider: attempt.provider,
        providerReference:
          attempt.providerReference ?? undefined,
        status:
          attempt.status === PaymentAttemptStatus.SUCCESS
            ? PaymentStatus.SUCCESS
            : PaymentStatus.PROCESSING,
      };
    }

    if (attempt.status === PaymentAttemptStatus.INITIATED) {
      throw new Error(
        "Payment initialization is already in progress",
      );
    }
  } else {
    await paymentRepository.updatePayment(payment.id, {
      status: PaymentStatus.PENDING,
      failureReason: null,
      failedAt: null,
    });
  }
    } else {
      // 5. First payment attempt.
      //
      // Payment + PaymentAttempt must be created atomically.
      //
      // The external provider is deliberately NOT called
      // inside this transaction.
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

        payment = result.payment;
        attempt = result.attempt;
      } catch (error) {
        // Two concurrent requests can both pass getByOrderId().
        //
        // Payment.orderId is UNIQUE, so the database allows
        // only one Payment to be created.
        if (isUniqueConstraintError(error)) {
          throw new Error(
            "A payment is already being initialized for this order",
          );
        }

        throw error;
      }
    }

    // 6. Initialize the payment with the external provider.
    //
    // This happens outside the DB transaction because
    // external network calls should not hold DB locks.
    try {
      const result = await provider.initializePayment({
        paymentId: payment.id,
        attemptId: attempt.id,
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        customerEmail: paymentContext.customerEmail,
        callbackUrl: input.callbackUrl,
      });

      // 7. Persist the provider reference on the attempt.
      //
      // PaymentAttempt owns provider-specific information.
      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: PaymentAttemptStatus.PROCESSING,
        providerReference: result.providerReference,
      });

      await paymentRepository.updatePayment(payment.id, {
        status: PaymentStatus.PROCESSING,
      });

      // 8. Return the initialization result.
      return {
        paymentId: payment.id,
        attemptId: attempt.id,
        provider: result.provider,
        providerReference: result.providerReference,
        authorizationUrl: result.authorizationUrl,
        status: PaymentStatus.PROCESSING,
      };
    } catch (error) {
      /*
       * Provider failures need to be classified carefully.
       *
       * A timeout/network/5xx can mean:
       *
       *   our request → Paystack → payment created
       *                              ↓
       *                         response lost
       *
       * Therefore we must NOT automatically mark the
       * payment as FAILED when the outcome is uncertain.
       */

      if (error instanceof PaymentProviderError) {
        if (error.uncertain) {
          await paymentRepository.updatePayment(payment.id, {
            failureReason: error.message,
          });

          await paymentRepository.updatePaymentAttempt(attempt.id, {
            failureReason: error.message,
          });
        } else {
          await paymentRepository.updatePayment(payment.id, {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureReason: error.message,
          });

          await paymentRepository.updatePaymentAttempt(attempt.id, {
            status: PaymentAttemptStatus.FAILED,
            failureReason: error.message,
            completedAt: new Date(),
          });
        }
      } else {
        // Unknown application error.
        //
        // We cannot safely assume the provider rejected
        // the request.
        const failureReason =
          error instanceof Error
            ? error.message
            : "Payment initialization failed";

        await paymentRepository.updatePayment(payment.id, {
          failureReason,
        });

        await paymentRepository.updatePaymentAttempt(attempt.id, {
          failureReason,
        });
      }

      throw error;
    }
  };

  return {
    initializePayment,
  };
};

export type PaymentService = ReturnType<typeof createPaymentService>;
