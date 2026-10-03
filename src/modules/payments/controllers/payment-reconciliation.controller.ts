import type { RequestHandler } from "express";

import { asyncHandler } from "../../../shared/utils/async-handler.js";

import type { PaymentReconciliationService } from "../services/payment-reconciliation.service.js";

type PaymentReconciliationControllerDependencies = {
  paymentReconciliationService: PaymentReconciliationService;
};

export const createPaymentReconciliationController = ({
  paymentReconciliationService,
}: PaymentReconciliationControllerDependencies) => {
  const verify: RequestHandler = asyncHandler(
    async (req, res) => {

        
  const paymentId = req.params.paymentId;

if (typeof paymentId !== "string") {
  res.status(400).json({
    success: false,
    message: "Invalid payment ID",
  });
  return;
}

const userId = req.user?.id;

if (!userId) {
  res.status(401).json({
    success: false,
    message: "Authentication required",
  });
  return;
}

const result =
  await paymentReconciliationService.reconcilePayment({
    paymentId,
    userId,
  });
      res.status(200).json({
        success: true,
        data: result,
      });
    },
  );

  return {
    verify,
  };
};

export type PaymentReconciliationController =
  ReturnType<typeof createPaymentReconciliationController>;