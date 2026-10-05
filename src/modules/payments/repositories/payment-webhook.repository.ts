import type {
  Prisma,
  PaymentProvider,
} from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createPaymentWebhookRepository = (
  db: DatabaseClient,
) => {
  const createWebhookEvent = async (
    data: Prisma.PaymentWebhookEventCreateInput,
  ) => {
    return db.paymentWebhookEvent.create({
      data,
    });
  };

  const getWebhookEvent = async (
    provider: PaymentProvider,
    eventKey: string,
  ) => {
    return db.paymentWebhookEvent.findUnique({
      where: {
        provider_eventKey: {
          provider,
          eventKey,
        },
      },
    });
  };

  const getWebhookEventForUpdate = async (
    provider: PaymentProvider,
    eventKey: string,
  ) => {
    await db.$queryRaw`
      SELECT "id"
      FROM "PaymentWebhookEvent"
      WHERE "provider" = ${provider}
        AND "eventKey" = ${eventKey}
      FOR UPDATE
    `;

    return db.paymentWebhookEvent.findUnique({
      where: {
        provider_eventKey: {
          provider,
          eventKey,
        },
      },
    });
  };

  const markWebhookProcessed = async (
    webhookEventId: string,
    processedAt: Date = new Date(),
  ) => {
    return db.paymentWebhookEvent.update({
      where: {
        id: webhookEventId,
      },
      data: {
        processedAt,
      },
    });
  };

  return {
    createWebhookEvent,
    getWebhookEvent,
    getWebhookEventForUpdate,
    markWebhookProcessed,
  };
};

export type PaymentWebhookRepository = ReturnType<
  typeof createPaymentWebhookRepository
>;