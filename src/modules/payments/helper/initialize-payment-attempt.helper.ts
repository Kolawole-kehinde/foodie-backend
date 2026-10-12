import {
  PaymentAttemptStatus,
  PaymentStatus,
  PrismaClient,
} from "@prisma/client";

import type { PaymentProviderClient } from "../providers/payment-provider.js";
import { PaymentProviderError } from "../errors/payment-provider.error.js";
import {
  createPaymentRepository,
  type PaymentRepository,
} from "../repositories/index.js";
import { canTransitionPaymentStatus } from "../policies/payment-status-transition.policy.js";

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
  const initializePaymentAttempt = async (
    input: InitializePaymentAttemptInput,
  ) => {
    const {
      paymentId,
      attemptId,
      amount,
      currency,
      customerEmail,
      callbackUrl,
    } = input;

    // Persist the reference before contacting the provider.
    await paymentRepository.updatePaymentAttempt(attemptId, {
      providerReference: attemptId,
    });

    let result: Awaited<
      ReturnType<typeof provider.initializePayment>
    >;

    try {
      result = await provider.initializePayment({
        paymentId,
        attemptId,
        reference: attemptId,
        amount,
        currency,
        customerEmail,
        callbackUrl,
      });
    } catch (error) {
      // An uncertain provider response must remain recoverable.
      if (
        !(error instanceof PaymentProviderError) ||
        error.uncertain
      ) {
        throw error;
      }

      await db.$transaction(async (tx) => {
        const repository = createPaymentRepository(tx);
        const payment = await repository.getByIdForUpdate(paymentId);

        if (!payment) {
          throw new Error("Payment not found");
        }

        const attempt =
          await repository.getPaymentAttemptById(attemptId);

        if (!attempt || attempt.paymentId !== paymentId) {
          throw new Error("Payment attempt not found");
        }

        // A concurrent webhook or verification may have won.
        if (
          payment.status === PaymentStatus.SUCCESS ||
          attempt.status === PaymentAttemptStatus.SUCCESS
        ) {
          return;
        }

        if (
          attempt.status !== PaymentAttemptStatus.INITIATED &&
          attempt.status !== PaymentAttemptStatus.PROCESSING
        ) {
          return;
        }

        if (
          payment.status !== PaymentStatus.PENDING &&
          payment.status !== PaymentStatus.PROCESSING
        ) {
          return;
        }

        await repository.updatePaymentAttempt(attemptId, {
          status: PaymentAttemptStatus.FAILED,
          failureReason: error.message,
          completedAt: new Date(),
        });

        if (
          canTransitionPaymentStatus(
            payment.status,
            PaymentStatus.FAILED,
          )
        ) {
          await repository.updatePayment(paymentId, {
            status: PaymentStatus.FAILED,
            failedAt: new Date(),
            failureReason: error.message,
          });
        }
      });

      throw error;
    }

    await db.$transaction(async (tx) => {
      const repository = createPaymentRepository(tx);
      const payment = await repository.getByIdForUpdate(paymentId);

      if (!payment) {
        throw new Error("Payment not found");
      }

      const attempt =
        await repository.getPaymentAttemptById(attemptId);

      if (!attempt || attempt.paymentId !== paymentId) {
        throw new Error("Payment attempt not found");
      }

      // Never downgrade a successful or terminal attempt.
      if (
        payment.status === PaymentStatus.SUCCESS ||
        attempt.status !== PaymentAttemptStatus.INITIATED
      ) {
        return;
      }

      if (
        payment.status !== PaymentStatus.PENDING &&
        payment.status !== PaymentStatus.PROCESSING
      ) {
        return;
      }

      await repository.updatePaymentAttempt(attemptId, {
        providerReference: result.providerReference,
        providerStatus: result.providerStatus,
        status: PaymentAttemptStatus.PROCESSING,
      });

      if (
        payment.status === PaymentStatus.PENDING &&
        canTransitionPaymentStatus(
          payment.status,
          PaymentStatus.PROCESSING,
        )
      ) {
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