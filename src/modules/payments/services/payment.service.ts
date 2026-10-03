import { PaymentAttemptStatus, PaymentStatus } from "@prisma/client";

import { createPaymentRepository } from "../repositories/payment.repository.js";

import type {
  InitializePaymentInput,
  PaymentServiceDependencies,
} from "../types/payment.types.js";

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


    // 2. Create payment and payment attempt
    // The transaction only handles database work.
    // The external provider is called after the transactionhas completed.
    const { payment, attempt } = await db.$transaction(async (tx) => {
      // Create a repository using the transaction client.
      // This keeps database access inside the repository layer.
      const transactionRepository = createPaymentRepository(tx);

      const createdPayment = await transactionRepository.createPayment({
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
      });

      const createdAttempt = await transactionRepository.createPaymentAttempt({
        payment: {
          connect: {
            id: createdPayment.id,
          },
        },
        provider: input.provider,
        amount: input.amount,
        currency: input.currency,
        status: PaymentAttemptStatus.INITIATED,
      });

      return {
        payment: createdPayment,
        attempt: createdAttempt,
      };
    });

    
    // 3. Resolve the configured payment provider
    const provider = paymentProviderRegistry.getProvider(input.provider);

    try {
      // ------------------------------------------------
      // 4. Initialize payment with the provider
      //
      // IMPORTANT:
      // This happens outside the database transaction.
      // External API calls should never hold database locks.
      // ------------------------------------------------

      const result = await provider.initializePayment({
        paymentId: payment.id,
        attemptId: attempt.id,
        amount: input.amount,
        currency: input.currency,
        customerEmail: input.customerEmail,
        callbackUrl: input.callbackUrl,
      });


      // 5. Persist provider reference and processing state
      await paymentRepository.updatePayment(payment.id, {
        status: PaymentStatus.PROCESSING,
        providerReference: result.providerReference,
      });

      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: PaymentAttemptStatus.PROCESSING,
      });

  
      // 6. Return payment initialization result
      return {
        paymentId: payment.id,
        attemptId: attempt.id,
        provider: result.provider,
        providerReference: result.providerReference,
        authorizationUrl: result.authorizationUrl,
        status: PaymentStatus.PROCESSING,
      };
    } catch (error) {
     
      // 7. Provider initialization failed, Mark both our payment and attempt as failed.
      const failureReason =
        error instanceof Error
          ? error.message
          : "Payment initialization failed";

      await paymentRepository.updatePayment(payment.id, {
        status: PaymentStatus.FAILED,
        failedAt: new Date(),
        failureReason,
      });

      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: PaymentAttemptStatus.FAILED,
        failureReason,
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
