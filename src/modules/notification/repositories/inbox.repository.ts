
import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

const STALE_PROCESSING_MS = 5 * 60 * 1000;

export const createInboxRepository = (db: DatabaseClient) => {
  const findByEventId = async (eventId: string) => {
    return db.inboxEvent.findUnique({
      where: { eventId },
    });
  };

  const create = async (data: Prisma.InboxEventCreateInput) => {
    return db.inboxEvent.create({
      data,
    });
  };

  const claimForProcessing = async (eventId: string) => {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS);

    const result = await db.inboxEvent.updateMany({
      where: {
        eventId,
        OR: [
          { status: "FAILED" },
          {
            status: "PROCESSING",
            updatedAt: { lt: staleBefore },
          },
        ],
      },
      data: {
        status: "PROCESSING",
        failureReason: null,
      },
    });

    return result.count === 1;
  };

  const updateStatus = async (
    eventId: string,
    data: Prisma.InboxEventUpdateInput,
  ) => {
    return db.inboxEvent.update({
      where: { eventId },
      data,
    });
  };

  return {
    findByEventId,
    create,
    claimForProcessing,
    updateStatus,
  };
};
