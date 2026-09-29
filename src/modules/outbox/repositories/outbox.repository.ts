import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createOutboxRepository = (db: DatabaseClient) => {
  const create = async (data: Prisma.OutboxEventCreateInput) => {
    return db.outboxEvent.create({
      data,
    });
  };

  /**
   * Atomically claims available outbox events.
   *
   * FOR UPDATE SKIP LOCKED prevents multiple workers
   * from claiming the same event.
   */
  const claimPendingEvents = async (limit: number, now: Date) => {
    return db.$queryRaw<
      Array<{
        id: string;
        eventType: string;
        aggregateType: string;
        aggregateId: string;
        payload: Prisma.JsonValue;
        status: string;
        attempts: number;
        availableAt: Date;
        processingAt: Date | null;
        publishedAt: Date | null;
        lastError: string | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      WITH claimed AS (
        SELECT "id"
        FROM "OutboxEvent"
        WHERE "status" IN ('PENDING', 'FAILED')
          AND "availableAt" <= ${now}
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${limit}
      )
      UPDATE "OutboxEvent" AS event
      SET
        "status" = 'PROCESSING',
        "processingAt" = ${now},
        "attempts" = event."attempts" + 1,
        "updatedAt" = NOW()
      FROM claimed
      WHERE event."id" = claimed."id"
      RETURNING
        event."id",
        event."eventType",
        event."aggregateType",
        event."aggregateId",
        event."payload",
        event."status",
        event."attempts",
        event."availableAt",
        event."processingAt",
        event."publishedAt",
        event."lastError",
        event."createdAt",
        event."updatedAt"
    `;
  };

  const findById = async (id: string) => {
    return db.outboxEvent.findUnique({
      where: { id },
    });
  };

  const markPublished = async (id: string, publishedAt: Date) => {
    return db.outboxEvent.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        processingAt: null,
        publishedAt,
        lastError: null,
      },
    });
  };

  const markFailed = async (
    id: string,
    availableAt: Date,
    lastError: string,
  ) => {
    return db.outboxEvent.update({
      where: { id },
      data: {
        status: "FAILED",
        processingAt: null,
        availableAt,
        lastError,
      },
    });
  };

  const markDeadLetter = async (id: string, lastError: string) => {
    return db.outboxEvent.update({
      where: { id },
      data: {
        status: "DEAD_LETTER",
        processingAt: null,
        lastError,
      },
    });
  };

  const recoverStaleEvents = async ( processingBefore: Date,) => {
  return db.outboxEvent.updateMany({
    where: {
      status: "PROCESSING",
      processingAt: {
        lt: processingBefore,
      },
    },
    data: {
      status: "PENDING",
      processingAt: null,
    },
  });
};

  return {
    create,
    claimPendingEvents,
    findById,
    markPublished,
    markFailed,
    recoverStaleEvents,
    markDeadLetter,
  };
};

export type OutboxRepository = ReturnType<typeof createOutboxRepository>;
