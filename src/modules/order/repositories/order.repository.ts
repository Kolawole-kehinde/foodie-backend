import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createOrderRepository = (db: DatabaseClient) => {
  const create = async (data: Prisma.OrderCreateInput) => {
    return db.order.create({
      data,
    });
  };

  const createOrderItem = async (data: Prisma.OrderItemCreateInput) => {
    return db.orderItem.create({
      data,
    });
  };

  const getById = async (id: string) => {
    return db.order.findUnique({
      where: {
        id,
      },
    });
  };

  const getByIdForUpdate = async (id: string) => {
    const orders = await db.$queryRaw<
      Array<{
        id: string;
        userId: string;
        status: string;
        totalAmount: Prisma.Decimal;
        reservationExpiresAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>
    >`
      SELECT
        "id",
        "userId",
        "status",
        "totalAmount",
        "reservationExpiresAt",
        "createdAt",
        "updatedAt"
      FROM "Order"
      WHERE "id" = ${id}
      FOR UPDATE
    `;

    return orders[0] ?? null;
  };

  const getOrderWithItems = async (id: string) => {
    return db.order.findUnique({
      where: {
        id,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: true,
      },
    });
  };

  const getUserOrders = async (userId: string) => {
    return db.order.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  const getUserOrderById = async (userId: string, orderId: string) => {
    return db.order.findFirst({
      where: {
        id: orderId,
        userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: true,
      },
    });
  };

  const updateStatus = async (id: string, data: Prisma.OrderUpdateInput) => {
    return db.order.update({
      where: {
        id,
      },
      data,
    });
  };

  const findExpiredPendingOrders = async (now: Date) => {
    return db.order.findMany({
      where: {
        status: "PENDING",
        reservationExpiresAt: {
          lt: now,
        },
      },
    });
  };

  return {
    create,
    createOrderItem,
    getById,
    getByIdForUpdate,
    getOrderWithItems,
    getUserOrders,
    getUserOrderById,
    updateStatus,
    findExpiredPendingOrders,
  };
};

export type OrderRepository = ReturnType<typeof createOrderRepository>;
