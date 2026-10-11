
import { DeliveryStatus, Prisma, type PrismaClient } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

type ClaimPendingDeliveriesOptions = {
  // Must be unique to this running worker instance.
  workerId: string;
  limit?: number;
  leaseMs?: number;
};

export const createNotificationDeliveryRepository = (db: DatabaseClient) => {
  const createDelivery = async (
    data: Prisma.NotificationDeliveryCreateInput,
  ) => {
    return db.notificationDelivery.create({ data });
  };

  const findDelivery = async (id: string) => {
    return db.notificationDelivery.findUnique({ where: { id } });
  };

  const updateDeliveryStatus = async (
    id: string,
    data: Prisma.NotificationDeliveryUpdateInput,
  ) => {
    return db.notificationDelivery.update({ where: { id }, data });
  };

  const incrementAttempts = async (id: string) => {
    return db.notificationDelivery.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });
  };

  // Atomically claims eligible deliveries so concurrent workers skip
  // rows that another worker has already locked.
  const claimPendingDeliveries = async ({
    workerId,
    limit = 20,
    leaseMs = 60_000,
  }: ClaimPendingDeliveriesOptions) => {
    if (!workerId.trim()) {
      throw new Error("A non-empty workerId is required");
    }

    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("limit must be a positive integer");
    }

    if (!Number.isInteger(leaseMs) || leaseMs < 1) {
      throw new Error("leaseMs must be a positive integer");
    }

    // This single SQL statement locks and claims jobs atomically.
    // It includes expired PROCESSING jobs so crashed workers can be recovered.
    const claimedRows = await db.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
        WITH candidates AS (
          SELECT "id"
          FROM "NotificationDelivery"
          WHERE
            "channel" = 'EMAIL'
            AND "attempts" < "maxAttempts"
            AND "deadLetteredAt" IS NULL
            AND (
              (
                "status" = 'PENDING'
                AND (
                  "nextRetryAt" IS NULL
                  OR "nextRetryAt" <= NOW()
                )
              )
              OR (
                "status" = 'FAILED'
                AND "nextRetryAt" IS NOT NULL
                AND "nextRetryAt" <= NOW()
              )
              OR (
                "status" = 'PROCESSING'
                AND "leaseExpiresAt" IS NOT NULL
                AND "leaseExpiresAt" <= NOW()
              )
            )
          ORDER BY "createdAt" ASC
          LIMIT ${limit}
          FOR UPDATE SKIP LOCKED
        )
        UPDATE "NotificationDelivery" AS delivery
        SET
          "status" = 'PROCESSING',
          "lockedBy" = ${workerId},
          "leaseExpiresAt" =
            NOW() + (${leaseMs} * INTERVAL '1 millisecond'),
          "attempts" = delivery."attempts" + 1,
          "lastAttemptAt" = NOW(),
          "updatedAt" = NOW()
        FROM candidates
        WHERE delivery."id" = candidates."id"
        RETURNING delivery."id"
      `,
    );

    if (claimedRows.length === 0) {
      return [];
    }

    const claimedIds = claimedRows.map((row) => row.id);

    // Load email details after claiming. The SQL statement above has
    // already committed its claim when this runs outside another transaction.
    return db.notificationDelivery.findMany({
      where: {
        id: { in: claimedIds },
        status: DeliveryStatus.PROCESSING,
        lockedBy: workerId,
      },
      include: {
        notification: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  };

  const findPendingDeliveries = async (limit = 20) => {
    const now = new Date();

    // Legacy query: do not use this to drive concurrent workers.
    // The worker should use claimPendingDeliveries() instead.
    return db.notificationDelivery.findMany({
      where: {
        channel: "EMAIL",
        attempts: { lt: 5 },
        OR: [
          { status: "PENDING" },
          {
            status: "FAILED",
            nextRetryAt: { lte: now },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: {
        notification: {
          include: {
            user: {
              select: { email: true },
            },
          },
        },
      },
    });
  };

  const findExhaustedDeliveries = async (limit = 20) => {
    const candidates = await db.notificationDelivery.findMany({
      where: {
        status: DeliveryStatus.FAILED,
        channel: "EMAIL",
      },
      orderBy: { updatedAt: "asc" },
      take: Math.max(limit * 5, 100),
    });

    return candidates
      .filter((delivery) => delivery.attempts >= delivery.maxAttempts)
      .slice(0, limit);
  };

  const markAsDeadLettered = async (id: string) => {
    return db.notificationDelivery.updateMany({
      where: {
        id,
        status: DeliveryStatus.FAILED,
        deadLetteredAt: null,
      },
      data: {
        deadLetteredAt: new Date(),
        nextRetryAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
      },
    });
  };

  return {
    createDelivery,
    findDelivery,
    updateDeliveryStatus,
    incrementAttempts,
    findPendingDeliveries,
    claimPendingDeliveries,
    findExhaustedDeliveries,
    markAsDeadLettered,
  };
};

export type NotificationDeliveryRepository = ReturnType<
  typeof createNotificationDeliveryRepository
>;
