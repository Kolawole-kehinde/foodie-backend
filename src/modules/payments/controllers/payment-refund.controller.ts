
import type { RequestHandler } from "express";

import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { createPaymentRefundSchema } from "../dto/payment-refund.dto.js";
import type { PaymentRefundService } from "../services/payment-refund/payment-refund.service.js";

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

      const idempotencyKey = req.header("Idempotency-Key")?.trim();

      if (!idempotencyKey) {
        res.status(400).json({
          success: false,
          message: "Idempotency-Key header is required",
        });
        return;
      }

      if (idempotencyKey.length > 255) {
        res.status(400).json({
          success: false,
          message: "Idempotency-Key cannot exceed 255 characters",
        });
        return;
      }

      const parsedInput = createPaymentRefundSchema.safeParse(req.body);

      if (!parsedInput.success) {
        res.status(400).json({
          success: false,
          message: "Invalid refund request",
          errors: parsedInput.error.flatten(),
        });
        return;
      }

      const refund = await paymentRefundService.createRefund({
        paymentId,
        userId,
        idempotencyKey,
        amount: parsedInput.data.amount,
        reason: parsedInput.data.reason,
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
