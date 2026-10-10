
import { PaymentAttemptStatus, PaymentStatus, Prisma, PrismaClient } from "@prisma/client";
import type { PaymentProviderClient } from "../providers/payment-provider.js";
import { PaymentProviderError } from "../errors/payment-provider.error.js";
import {
  createPaymentRepository,
  type PaymentRepository,
} from "../repositories/index.js";


type InitializePaymentAttemptInput = {
  paymentId: string;
  attemptId: string;
  amount: string;
  currency: string;
  customerEmail: string;
  callbackUrl?: string;
};

type InitializePaymentAttemptDependencies = {
  provider: PaymentProviderClient;
  paymentRepository: PaymentRepository;
  db: PrismaClient;
};

export const createInitializePaymentAttemptHelper = ({
  provider,
  paymentRepository,
  db,
}: InitializePaymentAttemptDependencies) => {
  const initializePaymentAttempt = async ({
    paymentId,
    attemptId,
    amount,
    currency,
    customerEmail,
    callbackUrl,
  }: InitializePaymentAttemptInput) => {
    const providerReference = attemptId;

    // Persist the reference before contacting the provider.
    await paymentRepository.updatePaymentAttempt(attemptId, {
      providerReference,
    });

    let result: Awaited<ReturnType<typeof provider.initializePayment>>;

    try {
      result = await provider.initializePayment({
        paymentId,
        attemptId,
        reference: providerReference,
        amount,
        currency,
        customerEmail,
        callbackUrl,
      });
    } catch (error) {
      // A timeout/network error may mean Paystack received the request.
      // Preserve the reference and current states for recovery.
      if (
        !(error instanceof PaymentProviderError) ||
        error.uncertain
      ) {
        throw error;
      }

      // A definitive rejection can fail the attempt, but never
      // overwrite a payment that has already succeeded.
      await db.$transaction(async (tx) => {
        const repository = createPaymentRepository(tx);

        await repository.getByIdForUpdate(paymentId);

        const [payment, attempt] = await Promise.all([
          repository.getById(paymentId),
          repository.getPaymentAttemptById(attemptId),
        ]);

        if (!payment || !attempt) {
          throw new Error("Payment or payment attempt not found");
        }

        if (
          payment.status === PaymentStatus.SUCCESS ||
          attempt.status === PaymentAttemptStatus.SUCCESS
        ) {
          return;
        }

        if (attempt.status === PaymentAttemptStatus.INITIATED) {
          await repository.updatePaymentAttempt(attemptId, {
            status: PaymentAttemptStatus.FAILED,
            failureReason: error.message,
          });
        }

        if (
          payment.status === PaymentStatus.PENDING ||
          payment.status === PaymentStatus.PROCESSING
        ) {
          await repository.updatePayment(paymentId, {
            status: PaymentStatus.FAILED,
          });
        }
      });

      throw error;
    }

    // Apply related state changes in one short transaction.
    await db.$transaction(async (tx) => {
      const repository = createPaymentRepository(tx);

      await repository.getByIdForUpdate(paymentId);

      const [payment, attempt] = await Promise.all([
        repository.getById(paymentId),
        repository.getPaymentAttemptById(attemptId),
      ]);

      if (!payment || !attempt) {
        throw new Error("Payment or payment attempt not found");
      }

      // Do not downgrade a success received through a webhook.
      if (
        payment.status === PaymentStatus.SUCCESS ||
        attempt.status === PaymentAttemptStatus.SUCCESS
      ) {
        return;
      }

      if (attempt.status === PaymentAttemptStatus.INITIATED) {
        await repository.updatePaymentAttempt(attemptId, {
          providerReference: result.providerReference,
          providerStatus: result.providerStatus,
          status: PaymentAttemptStatus.PROCESSING,
        });
      }

      if (payment.status === PaymentStatus.PENDING) {
        await repository.updatePayment(paymentId, {
          status: PaymentStatus.PROCESSING,
        });
      }
    });

    return {
      paymentId,
      attemptId,
      provider: result.provider,
      providerReference: result.providerReference,
      providerStatus: result.providerStatus,
      authorizationUrl: result.authorizationUrl,
      accessCode: result.accessCode,
      status: result.status,
    };
  };

  return { initializePaymentAttempt };
};

export type InitializePaymentAttemptHelper = ReturnType<
  typeof createInitializePaymentAttemptHelper
>;
