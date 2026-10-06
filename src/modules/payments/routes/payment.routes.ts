import { Router } from "express";
import type { RequestHandler } from "express";

import type { PaymentController } from "../controllers/payment.controller.js";
import type { PaymentQueryController } from "../controllers/payment-query.controller.js";
import type { PaymentReconciliationController } from "../controllers/payment-reconciliation.controller.js";
import type { PaymentRefundController } from "../controllers/payment-refund.controller.js";
import type { PaymentRefundQueryController } from "../controllers/payment-refund-query.controller.js";

type PaymentRoutesDependencies = {
  paymentController: PaymentController;
  paymentQueryController: PaymentQueryController;
  paymentReconciliationController: PaymentReconciliationController;
  paymentRefundController: PaymentRefundController;
  paymentRefundQueryController: PaymentRefundQueryController;
  authenticate: RequestHandler;
};

export const createPaymentRoutes = ({
  paymentController,
  paymentQueryController,
  paymentReconciliationController,
  paymentRefundController,
  paymentRefundQueryController,
  authenticate,
}: PaymentRoutesDependencies): Router => {
  const router = Router();

  // Initialize payment POST /payments
   //  Requires authentication. Idempotency-Key is required by the controller.
   
  router.post(
    "/", 
    authenticate, 
    paymentController.initialize);

  // Payment provider webhook
  // POST /payments/webhook/:provider
  
  router.post(
    "/webhook/:provider",
     paymentController.webhook);

  //Get payment, 
  router.get(
    "/:paymentId", 
    authenticate, 
    paymentQueryController.getById);

  
  // Verify/reconcile payment with provider
  router.post(
    "/:paymentId/verify",
    authenticate,
    paymentReconciliationController.verify,
  );

  // Initiate refund
  router.post(
    "/:paymentId/refund",
    authenticate,
    paymentRefundController.createRefund,
  );

  // Get payment refunds
  router.get(
    "/:paymentId/refunds",
    authenticate,
    paymentRefundQueryController.getByPaymentId,
  );

  return router;
};

export type PaymentRoutes = ReturnType<typeof createPaymentRoutes>;
