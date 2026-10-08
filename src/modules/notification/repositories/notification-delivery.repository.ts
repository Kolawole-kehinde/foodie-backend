import type { Prisma } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createNotificationDeliveryRepository = (
  db: DatabaseClient,
) => {
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

  return {
    createDelivery,
    findDelivery,
    updateDeliveryStatus,
    incrementAttempts,
  };
};