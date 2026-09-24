import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

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

  const createMovement = (data: Prisma.InventoryMovementCreateInput) => {
    return db.inventoryMovement.create({
      data,
    });
  };

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
    getById,
    update,
    createMovement,
    getMovements,
  };
};

export type InventoryRepository = ReturnType<typeof createInventoryRepository>;
