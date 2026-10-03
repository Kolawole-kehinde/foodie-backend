import type { RequestHandler } from "express";

import { asyncHandler } from "../../../shared/utils/async-handler.js";

import type { PaymentQueryService } from "../services/payment-query.service.js";

type PaymentQueryControllerDependencies = {
  paymentQueryService: PaymentQueryService;
};

export const createPaymentQueryController = ({
  paymentQueryService,
}: PaymentQueryControllerDependencies) => {
  const getById: RequestHandler = asyncHandler(
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

      const payment =
        await paymentQueryService.getPaymentById({
          paymentId,
          userId,
        });

      res.status(200).json({
        success: true,
        data: payment,
      });
    },
  );

  return {
    getById,
  };
};

export type PaymentQueryController = ReturnType<
  typeof createPaymentQueryController
>;