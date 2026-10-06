import type { RequestHandler } from "express";

import { asyncHandler } from "../../../shared/utils/async-handler.js";

import type { PaymentRefundQueryService } from "../services/payment-refund/payment-refund-query.service.js";

type PaymentRefundQueryControllerDependencies = {
  paymentRefundQueryService: PaymentRefundQueryService;
};

export type PaymentRefundQueryController = {
  getByPaymentId: RequestHandler;
};


export const createPaymentRefundQueryController = ({
  paymentRefundQueryService,
}: PaymentRefundQueryControllerDependencies): PaymentRefundQueryController => {
  const getByPaymentId: RequestHandler = asyncHandler(
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

      const refunds =
        await paymentRefundQueryService.getRefundsByPaymentId({
          paymentId,
          userId,
        });

      res.status(200).json({
        success: true,
        data: refunds,
      });
    },
  );

  return {
    getByPaymentId,
  };
};
