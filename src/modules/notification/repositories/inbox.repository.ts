
import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createInboxRepository = (db: DatabaseClient) => {
  const findByEventId = async (eventId: string) => {
    return db.inboxEvent.findUnique({
      where: { eventId },
    });
  };

  const create = async (data: Prisma.InboxEventCreateInput) => {
    return db.inboxEvent.create({ data });
  };

  const claimForProcessing = async (
    eventId: string,
    claimToken: string,
    leaseDurationMs: number,
  ) => {
    const now = new Date();

    const result = await db.inboxEvent.updateMany({
      where: {
        eventId,
        OR: [
          { status: "FAILED" },
          {
            status: "PROCESSING",
            leaseExpiresAt: { lte: now },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        claimToken,
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
        processedAt: null,
        failureReason: null,
      },
    });

    return result.count === 1;
  };

  const renewLease = async (
    eventId: string,
    claimToken: string,
    leaseDurationMs: number,
  ) => {
    const now = new Date();

    const result = await db.inboxEvent.updateMany({
      where: {
        eventId,
        status: "PROCESSING",
        claimToken,
        leaseExpiresAt: { gt: now },
      },
      data: {
        leaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
      },
    });

    return result.count === 1;
  };

  const markProcessed = async (
    eventId: string,
    claimToken: string,
  ) => {
    const now = new Date();

    const result = await db.inboxEvent.updateMany({
      where: {
        eventId,
        status: "PROCESSING",
        claimToken,
        leaseExpiresAt: { gt: now },
      },
      data: {
        status: "PROCESSED",
        processedAt: now,
        failureReason: null,
        claimToken: null,
        leaseExpiresAt: null,
      },
    });

    return result.count === 1;
  };

  const markFailed = async (
    eventId: string,
    claimToken: string,
    failureReason: string,
  ) => {
    const now = new Date();

    const result = await db.inboxEvent.updateMany({
      where: {
        eventId,
        status: "PROCESSING",
        claimToken,
        leaseExpiresAt: { gt: now },
      },
      data: {
        status: "FAILED",
        failureReason,
        claimToken: null,
        leaseExpiresAt: null,
      },
    });

    return result.count === 1;
  };

  return {
    findByEventId,
    create,
    claimForProcessing,
    renewLease,
    markProcessed,
    markFailed,
  };
};
