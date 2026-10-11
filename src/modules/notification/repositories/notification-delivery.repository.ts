
import { DeliveryStatus, Prisma, type PrismaClient } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

type ClaimPendingDeliveriesOptions = {
  workerId: string;
  limit?: number;
  leaseMs?: number;
};

export const createNotificationDeliveryRepository = (db: DatabaseClient) => {
  const createDelivery = async (
    data: Prisma.NotificationDeliveryCreateInput,
  ) => db.notificationDelivery.create({ data });

  const findDelivery = async (id: string) =>
    db.notificationDelivery.findUnique({ where: { id } });

  const updateDeliveryStatus = async (
    id: string,
    data: Prisma.NotificationDeliveryUpdateInput,
  ) => db.notificationDelivery.update({ where: { id }, data });

  const incrementAttempts = async (id: string) =>
    db.notificationDelivery.update({
      where: { id },
      data: {
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
      },
    });

  // Atomically claim eligible jobs. SKIP LOCKED lets concurrent workers
  // claim separate rows without waiting for each other.
  const claimPendingDeliveries = async ({
    workerId,
    limit = 20,
    leaseMs = 60_000,
  }: ClaimPendingDeliveriesOptions) => {
    if (!workerId.trim()) throw new Error("workerId is required");
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("limit must be a positive integer");
    }
    if (!Number.isInteger(leaseMs) || leaseMs < 1) {
      throw new Error("leaseMs must be a positive integer");
    }

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
          "nextRetryAt" = NULL,
          "failureReason" = NULL,
          "updatedAt" = NOW()
        FROM candidates
        WHERE delivery."id" = candidates."id"
        RETURNING delivery."id"
      `,
    );

    if (claimedRows.length === 0) return [];

    // Load notification and recipient details after the atomic claim.
    const claimedIds = claimedRows.map((row) => row.id);

    return db.notificationDelivery.findMany({
      where: {
        id: { in: claimedIds },
        status: DeliveryStatus.PROCESSING,
        lockedBy: workerId,
      },
      include: {
        notification: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  };

  // Renew only a lease that this worker still owns and that has not expired.
  const renewLease = async (
    id: string,
    workerId: string,
    leaseMs = 60_000,
  ) => {
    if (!Number.isInteger(leaseMs) || leaseMs < 1) {
      throw new Error("leaseMs must be a positive integer");
    }

    return db.notificationDelivery.updateMany({
      where: {
        id,
        status: DeliveryStatus.PROCESSING,
        lockedBy: workerId,
        leaseExpiresAt: { gt: new Date() },
      },
      data: {
        leaseExpiresAt: new Date(Date.now() + leaseMs),
      },
    });
  };

  // Finalize success only while the worker still owns a valid lease.
  const markSentIfOwned = async (
    id: string,
    workerId: string,
    providerMessageId: string,
  ) => {
    const now = new Date();

    return db.notificationDelivery.updateMany({
      where: {
        id,
        status: DeliveryStatus.PROCESSING,
        lockedBy: workerId,
        leaseExpiresAt: { gt: now },
      },
      data: {
        status: DeliveryStatus.SENT,
        providerMessageId,
        deliveredAt: now,
        failureReason: null,
        nextRetryAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
      },
    });
  };

  // Finalize failure only while the worker still owns a valid lease.
  const markFailedIfOwned = async (
  id: string,
  workerId: string,
  failureReason: string,
  nextRetryAt: Date | null,
  permanent = false,
) => {
  const now = new Date();

  return db.notificationDelivery.updateMany({
    where: {
      id,
      status: DeliveryStatus.PROCESSING,
      lockedBy: workerId,
      leaseExpiresAt: { gt: now },
    },
    data: {
      status: DeliveryStatus.FAILED,
      failureReason,
      nextRetryAt,
      // Permanently failed deliveries are immediately marked as dead-lettered.
      deadLetteredAt: permanent ? now : null,
      lockedBy: null,
      leaseExpiresAt: null,
    },
  });
};
  // Keep this method only for callers that still need a non-claiming query.
  // Do not use it to drive concurrent delivery workers.
  const findPendingDeliveries = async (limit = 20) => {
    const now = new Date();

    return db.notificationDelivery.findMany({
      where: {
        channel: "EMAIL",
        attempts: { lt: 5 },
        OR: [
          { status: DeliveryStatus.PENDING },
          {
            status: DeliveryStatus.FAILED,
            nextRetryAt: { lte: now },
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      take: limit,
      include: {
        notification: {
          include: {
            user: { select: { email: true } },
          },
        },
      },
    });
  };


const findExhaustedDeliveries = async (limit = 20) => {
  const deliveries = await db.notificationDelivery.findMany({
    where: {
      status: DeliveryStatus.FAILED,
      channel: "EMAIL",
      OR: [
        { deadLetteredAt: { not: null } },
        { attempts: { gte: 1 } },
      ],
    },
    orderBy: { updatedAt: "asc" },
    take: Math.max(limit * 5, 100),
  });

  // Include permanent failures already marked as dead-lettered and
  // deliveries that have exhausted their allowed attempts.
  return deliveries
    .filter(
      (delivery) =>
        delivery.deadLetteredAt !== null ||
        delivery.attempts >= delivery.maxAttempts,
    )
    .slice(0, limit);
};

  const markAsDeadLettered = async (id: string) =>
    db.notificationDelivery.updateMany({
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

  return {
    createDelivery,
    findDelivery,
    updateDeliveryStatus,
    incrementAttempts,
    findPendingDeliveries,
    claimPendingDeliveries,
    renewLease,
    markSentIfOwned,
    markFailedIfOwned,
    findExhaustedDeliveries,
    markAsDeadLettered,
  };
};

export type NotificationDeliveryRepository = ReturnType<
  typeof createNotificationDeliveryRepository
>;
