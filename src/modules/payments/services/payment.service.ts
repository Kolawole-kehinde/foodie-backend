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
  paymentProcessingService,
}: PaymentServiceDependencies) => {
  const initializePayment = async (input: InitializePaymentInput) => {
    // 1. Prepare trusted payment context from the order
    const paymentContext = await paymentProcessingService.preparePayment({
      orderId: input.orderId,
      userId: input.userId,
      provider: input.provider,
    });

    // 2. Prevent duplicate payment for the same order
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

    // 3. Create payment and payment attempt
    // The transaction only handles database work.
    // The external provider is called after the transaction completes.
    const { payment, attempt } = await db.$transaction(async (tx) => {
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
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        status: PaymentAttemptStatus.INITIATED,
      });

      return {
        payment: createdPayment,
        attempt: createdAttempt,
      };
    });

    // 4. Resolve configured payment provider
    const provider = paymentProviderRegistry.getProvider(input.provider);

    try {
      // 5. Initialize payment with provider
      // External API call happens outside the DB transaction.
      const result = await provider.initializePayment({
        paymentId: payment.id,
        attemptId: attempt.id,
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        customerEmail: paymentContext.customerEmail,
        callbackUrl: input.callbackUrl,
      });

      // 6. Persist provider reference and processing state
      await paymentRepository.updatePayment(payment.id, {
        status: PaymentStatus.PROCESSING,
        providerReference: result.providerReference,
      });

      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: PaymentAttemptStatus.PROCESSING,
        providerReference: result.providerReference,
      });

      // 7. Return payment initialization result
      return {
        paymentId: payment.id,
        attemptId: attempt.id,
        provider: result.provider,
        providerReference: result.providerReference,
        authorizationUrl: result.authorizationUrl,
        status: PaymentStatus.PROCESSING,
      };
    } catch (error) {
      // 8. Provider initialization failed
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
