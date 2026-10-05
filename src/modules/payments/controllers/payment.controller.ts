import type { RequestHandler } from "express";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { InitializePaymentDto } from "../dto/payment.dto.js";
import type { PaymentService } from "../services/payment.service.js";
import type { PaymentWebhookService } from "../services/payment-webhook.service.js";

type PaymentControllerDependencies = {
  paymentService: PaymentService;
  paymentWebhookService: PaymentWebhookService;
};

export type PaymentController = {
  initialize: RequestHandler;
  webhook: RequestHandler
};


export const createPaymentController = ({
  paymentService,
  paymentWebhookService,
}: PaymentControllerDependencies): PaymentController => {

  const initialize: RequestHandler = asyncHandler(async (req, res) => {
    const input = req.body as InitializePaymentDto;

    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    const idempotencyKey = req.header("Idempotency-Key");

    if (!idempotencyKey) {
      res.status(400).json({
        success: false,
        message: "Idempotency-Key header is required",
      });
      return;
    }

    const result = await paymentService.initializePayment({
      ...input,
      userId,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      data: result,
    });
  });

 const webhook: RequestHandler = asyncHandler(async (req, res) => {
  const providerParam = req.params.provider;

  if (typeof providerParam !== "string") {
    res.status(400).json({
      success: false,
      message: "Invalid payment provider",
    });
    return;
  }

  if (!Buffer.isBuffer(req.body)) {
    res.status(400).json({
      success: false,
      message: "Invalid webhook body",
    });
    return;
  }

  const result = await paymentWebhookService.handleWebhook({
    provider: providerParam.toUpperCase() as Parameters<
      PaymentWebhookService["handleWebhook"]
    >[0]["provider"],
    rawBody: req.body,
    headers: {
      "x-paystack-signature":
        typeof req.headers["x-paystack-signature"] === "string"
          ? req.headers["x-paystack-signature"]
          : undefined,
    },
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

  return {
    initialize,
    webhook,
  };
};
