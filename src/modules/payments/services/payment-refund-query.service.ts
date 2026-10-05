import type { PaymentRepository } from "../repositories/index.js";


type PaymentRefundQueryServiceDependencies = {
  paymentRepository: PaymentRepository;
};

export const createPaymentRefundQueryService = ({
  paymentRepository,
}: PaymentRefundQueryServiceDependencies) => {
  const getRefundsByPaymentId = async ({
    paymentId,
    userId,
  }: {
    paymentId: string;
    userId: string;
  }) => {
    const payment = await paymentRepository.getById(paymentId);

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.userId !== userId) {
      throw new Error("You cannot access refunds for this payment");
    }

    return paymentRepository.getRefundsByPaymentId(paymentId);
  };

  return {
    getRefundsByPaymentId,
  };
};

export type PaymentRefundQueryService = ReturnType<
  typeof createPaymentRefundQueryService
>;