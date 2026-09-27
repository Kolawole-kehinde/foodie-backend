import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

type LockedInventory = {
  id: string;
  productId: string;
  quantity: number;
  reservedQuantity: number;
  lowStockThreshold: number;
  createdAt: Date;
  updatedAt: Date;
};

export const createInventoryRepository = (db: DatabaseClient) => {
  const create = async (data: Prisma.InventoryCreateInput) => {
    return db.inventory.create({
      data,
    });
  };

  const getByProductId = async (productId: string) => {
    return db.inventory.findUnique({
      where: {
        productId,
      },
    });
  };

  const getByProductIdForUpdate = async (productId: string,): Promise<LockedInventory | null> => {
    const inventory = await db.inventory.findUnique({
      where: {
        productId,
      },
      select: {
        id: true,
      },
    });

    if (!inventory) {
      return null;
    }

    const [lockedInventory] = await db.$queryRaw<LockedInventory[]>`
      SELECT
        "id",
        "productId",
        "quantity",
        "reservedQuantity",
        "lowStockThreshold",
        "createdAt",
        "updatedAt"
      FROM "Inventory"
      WHERE "id" = ${inventory.id}
      FOR UPDATE
    `;

    return lockedInventory ?? null;
  };

  const getById = async (id: string) => {
    return db.inventory.findUnique({
      where: {
        id,
      },
    });
  };

  const update = async (id: string, data: Prisma.InventoryUpdateInput) => {
    return db.inventory.update({
      where: {
        id,
      },
      data,
    });
  };

  // Records what happened to the stock.
  const createMovement = (data: Prisma.InventoryMovementCreateInput) => {
    return db.inventoryMovement.create({
      data,
    });
  };

  // Retrieves the stock history, newest first.
  const getMovements = (inventoryId: string) => {
    return db.inventoryMovement.findMany({
      where: {
        inventoryId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  return {
    create,
    getByProductId,
    getByProductIdForUpdate,
    getById,
    update,
    createMovement,
    getMovements,
  };
};

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
