import type { PaymentRepository } from "../repositories/payment.repository.js";

type PaymentQueryServiceDependencies = {
  paymentRepository: PaymentRepository;
};

export const createPaymentQueryService = ({
  paymentRepository,
}: PaymentQueryServiceDependencies) => {
    
  const getPaymentById = async ({
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
      throw new Error("You cannot access this payment");
    }

    return payment;
  };

  return {
    getPaymentById,
  };
};

export type PaymentQueryService = ReturnType<
  typeof createPaymentQueryService
>;