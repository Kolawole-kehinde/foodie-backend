import type { RequestHandler } from "express";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { CreatePaymentRefundDto } from "../dto/payment-refund.dto.js";
import type { PaymentRefundService } from "../services/payment-refund.service.js";

type PaymentRefundControllerDependencies = {
  paymentRefundService: PaymentRefundService;
};

export type PaymentRefundController = {
  createRefund: RequestHandler;
};


export const createPaymentRefundController = ({
  paymentRefundService,
}: PaymentRefundControllerDependencies): PaymentRefundController => {
  const createRefund: RequestHandler = asyncHandler(
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

      const input = req.body as CreatePaymentRefundDto;

      const refund =
        await paymentRefundService.createRefund({
          paymentId,
          userId,
          amount: input.amount,
          reason: input.reason,
        });

      res.status(201).json({
        success: true,
        data: refund,
      });
    },
  );

  return {
    createRefund,
  };
};
