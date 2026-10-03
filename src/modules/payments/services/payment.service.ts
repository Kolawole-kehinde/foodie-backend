import { PaymentAttemptStatus, PaymentStatus, PrismaClient } from "@prisma/client";
import type { InitializePaymentInput, PaymentServiceDependencies } from "../types/payment.types.js";



export const createPaymentService = ({
  db,
  paymentRepository,
  paymentProviderRegistry,
}: PaymentServiceDependencies) => {

  const initializePayment = async (input: InitializePaymentInput) => {
  
    // 1. Prevent duplicate payment for the same order
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


    // 2. Create our payment and payment attempt
    // The external provider must NOT be called inside this transaction.
    const { payment, attempt } = await db.$transaction(async (tx) => {
      const transactionRepository =
        // Reuse the same repository factory with the
        // transaction client.
        // This keeps database access inside the repository.
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        undefined;

      void transactionRepository;

      const createdPayment = await tx.payment.create({
        data: {
          order: {
            connect: {
              id: input.orderId,
            },
          },
          user: {
            connect: {
              id: input.userId,
            },
          },
          amount: input.amount,
          currency: input.currency,
          provider: input.provider,
          status: PaymentStatus.PENDING,
        },
      });

      const createdAttempt = await tx.paymentAttempt.create({
        data: {
          payment: {
            connect: {
              id: createdPayment.id,
            },
          },
          provider: input.provider,
          amount: input.amount,
          currency: input.currency,
          status: PaymentAttemptStatus.INITIATED,
        },
      });

      return {
        payment: createdPayment,
        attempt: createdAttempt,
      };
    });

    // --------------------------------------------------
    // 3. Resolve the configured provider
    // --------------------------------------------------

    const provider = paymentProviderRegistry.getProvider(input.provider);

    try {
      // ------------------------------------------------
      // 4. Initialize the payment with the provider
      //
      // This is intentionally outside the DB transaction.
      // External API calls should never hold DB locks.
      // ------------------------------------------------

      const result = await provider.initializePayment({
        paymentId: payment.id,
        attemptId: attempt.id,
        amount: input.amount,
        currency: input.currency,
        customerEmail: input.customerEmail,
        callbackUrl: input.callbackUrl,
      });

    
      // 5. Persist provider information
      await paymentRepository.updatePayment(payment.id, {
        status: PaymentStatus.PROCESSING,
        providerReference: result.providerReference,
      });

      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: PaymentAttemptStatus.PROCESSING,
      });

      return {
        paymentId: payment.id,
        attemptId: attempt.id,
        provider: result.provider,
        providerReference: result.providerReference,
        authorizationUrl: result.authorizationUrl,
        status: PaymentStatus.PROCESSING,
      };
    } catch (error) {
      // ------------------------------------------------
      // Provider initialization failed.
      //
      // Keep our database state consistent with what
      // happened externally.
      // ------------------------------------------------

      await paymentRepository.updatePayment(payment.id, {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failureReason:
          error instanceof Error
            ? error.message
            : "Payment initialization failed",
      });

      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: PaymentAttemptStatus.FAILED,
        failureReason:
          error instanceof Error
            ? error.message
            : "Payment initialization failed",
        completedAt: new Date(),
      });

      throw error;
    }
  };

  return {
    initializePayment,
  };
};

export type PaymentService = ReturnType<typeof createPaymentService>;
