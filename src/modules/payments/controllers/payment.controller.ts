import type { RequestHandler } from "express";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { InitializePaymentDto } from "../dto/payment.dto.js";
import type { PaymentService } from "../services/payment.service.js";
import type { PaymentWebhookService } from "../services/payment-webhook.service.js";

type PaymentControllerDependencies = {
  paymentService: PaymentService;
  paymentWebhookService: PaymentWebhookService;
};

export const createPaymentController = ({
  paymentService,
  paymentWebhookService,
}: PaymentControllerDependencies) => {
    
  const initialize: RequestHandler = asyncHandler(
    async (req, res) => {
      const input = req.body as InitializePaymentDto;

      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const result = await paymentService.initializePayment({
        ...input,
        userId,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    },
  );

  const webhook: RequestHandler = asyncHandler(
    async (req, res) => {
      const providerParam = req.params.provider;

      if (typeof providerParam !== "string") {
        res.status(400).json({
          success: false,
          message: "Invalid payment provider",
        });
        return;
      }

      const signature =
        req.headers["x-paystack-signature"];

      if (typeof signature !== "string") {
        res.status(400).json({
          success: false,
          message: "Payment webhook signature is required",
        });
        return;
      }

      const rawBody = req.body.toString("utf8");

      const result =
        await paymentWebhookService.handleWebhook({
          provider: providerParam.toUpperCase() as
            Parameters<
              PaymentWebhookService["handleWebhook"]
            >[0]["provider"],
          rawBody,
          signature,
        });

      res.status(200).json({
        success: true,
        data: result,
      });
    },
  );

  return {
    initialize,
    webhook,
  };
};

export type PaymentController = ReturnType<
  typeof createPaymentController
>;