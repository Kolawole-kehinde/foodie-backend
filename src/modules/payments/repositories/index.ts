import type { DatabaseClient } from "../../../database/prisma/types.js";

import { createPaymentRepository as createBasePaymentRepository } from "./payment.repository.js";
import { createPaymentAttemptRepository } from "./payment-attempt.repository.js";
import { createPaymentWebhookRepository } from "./payment-webhook.repository.js";
import { createPaymentRefundRepository } from "./payment-refund.repository.js";

export const createPaymentRepository = (db: DatabaseClient) => {
  return {
    ...createBasePaymentRepository(db),
    ...createPaymentAttemptRepository(db),
    ...createPaymentWebhookRepository(db),
    ...createPaymentRefundRepository(db),
  };
};

export type PaymentRepository = ReturnType<
  typeof createPaymentRepository
>;