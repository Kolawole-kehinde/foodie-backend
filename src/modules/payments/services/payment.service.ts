import { PaymentAttemptStatus, PaymentStatus } from "@prisma/client";
import { createPaymentRepository } from "../repositories/payment.repository.js";
import { PaymentProviderError } from "../errors/payment-provider.error.js";
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

    // 3. Prevent an already completed payment.
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

      // A previous FAILED payment can be retried.
    }

    // 4. Create the payment aggregate and attempt atomically.
    //
    // The external provider is deliberately NOT called
    // inside this transaction.
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

    try {
      // 5. Initialize the payment with the external provider.
      //
      // This happens outside the DB transaction because
      // external network calls should not hold DB locks.
      const result = await provider.initializePayment({
        paymentId: payment.id,
        attemptId: attempt.id,
        amount: paymentContext.amount,
        currency: paymentContext.currency,
        customerEmail: paymentContext.customerEmail,
        callbackUrl: input.callbackUrl,
      });

      // 6. Persist the provider reference on the attempt.
      //
      // PaymentAttempt owns provider-specific information.
      await paymentRepository.updatePaymentAttempt(attempt.id, {
        status: PaymentAttemptStatus.PROCESSING,
        providerReference: result.providerReference,
      });

      await paymentRepository.updatePayment(payment.id, {
        status: PaymentStatus.PROCESSING,
      });

      // 7. Return the initialization result.
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
