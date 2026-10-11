import { DeliveryStatus, type Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createNotificationDeliveryRepository = (db: DatabaseClient) => {
  const createDelivery = async (
    data: Prisma.NotificationDeliveryCreateInput,
  ) => {
    return db.notificationDelivery.create({
      data,
    });
  };

  const findDelivery = async (id: string) => {
    return db.notificationDelivery.findUnique({
      where: {
        id,
      },
    });
  };

  const updateDeliveryStatus = async (
    id: string,
    data: Prisma.NotificationDeliveryUpdateInput,
  ) => {
    return db.notificationDelivery.update({
      where: {
        id,
      },
      data,
    });
  };

  const incrementAttempts = async (id: string) => {
    return db.notificationDelivery.update({
      where: {
        id,
      },
      data: {
        attempts: {
          increment: 1,
        },
        lastAttemptAt: new Date(),
      },
    });
  };

  const findPendingDeliveries = async (limit = 20) => {
    const now = new Date();

    return db.notificationDelivery.findMany({
      where: {
        channel: "EMAIL",
        attempts: {
          lt: 5,
        },
        OR: [
          {
            status: "PENDING",
          },
          {
            status: "FAILED",
            nextRetryAt: {
              lte: now,
            },
          },
        ],
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
      include: {
        notification: {
          include: {
            user: {
              select: {
                email: true,
              },
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
      },
    });
  };

  return {
    createDelivery,
    findDelivery,
    updateDeliveryStatus,
    incrementAttempts,
    findPendingDeliveries,
    findExhaustedDeliveries,
    markAsDeadLettered,
  };
};
