import type { PrismaClient } from "@prisma/client";
import type { InventoryRepository } from "../repositories/inventory.repositories.js";
import { createInventoryRepository } from "../repositories/inventory.repositories.js";
import type { ProductRepository } from "../../catalog/repositories/product.repository.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

type InventoryServiceDependencies = {
  db: PrismaClient;
  inventoryRepository: InventoryRepository;
  productRepository: ProductRepository;
};

export const createInventoryService = ({ db, inventoryRepository, productRepository,
}: InventoryServiceDependencies) => {

  const initialize = async (productId: string) => {
     const product = await productRepository.getProductById(productId);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    const existingInventory =  await inventoryRepository.getByProductId(productId);

    if (existingInventory) {
      throw new ConflictError("Inventory already exists for this product");
    }

    return inventoryRepository.create({
      product: {
        connect: {
          id: productId,
        },
      },
      quantity: 0,
      reservedQuantity: 0,
      lowStockThreshold: 5,
    });
  };

  const getByProductId = async (productId: string) => {
    const inventory = await inventoryRepository.getByProductId(productId);

    if (!inventory) {
      throw new NotFoundError("Inventory not found");
    }

    return inventory;
  };

  const getById = async (id: string) => {
    const inventory = await inventoryRepository.getById(id);

    if (!inventory) {
      throw new NotFoundError("Inventory not found");
    }

    return inventory;
  };

  const addStock = async (
    productId: string,
    quantity: number,
    reason?: string,
  ) => {
    if (quantity <= 0) {
      throw new ConflictError("Stock quantity must be greater than zero");
    }

    const inventory = await inventoryRepository.getByProductId(productId);

    if (!inventory) {
      throw new NotFoundError("Inventory not found");
    }

    return db.$transaction(async (tx) => {
      const transactionRepository = createInventoryRepository(tx);

      const updatedInventory = await transactionRepository.update(
        inventory.id,
        {
          quantity: {
            increment: quantity,
          },
        },
      );

      await transactionRepository.createMovement({
        inventory: {
          connect: {
            id: inventory.id,
          },
        },
        type: "STOCK_IN",
        quantity,
        reason,
      });

      return updatedInventory;
    });
  };

  const removeStock = async (
    productId: string,
    quantity: number,
    reason?: string,
  ) => {
    if (quantity <= 0) {
      throw new ConflictError("Stock quantity must be greater than zero");
    }

    const inventory = await inventoryRepository.getByProductId(productId);

    if (!inventory) {
      throw new NotFoundError("Inventory not found");
    }

    return db.$transaction(async (tx) => {
      /*
       * Lock this inventory row until the transaction finishes.
       *
       * This prevents two simultaneous stock-out requests
       * from reading the same available quantity and both
       * succeeding.
       */
    const lockedInventory = await tx.$queryRaw<
  Array<{
    id: string;
    quantity: number;
    reservedQuantity: number;
  }>
>`
  SELECT
    "id",
    "quantity",
    "reservedQuantity"
  FROM "Inventory"
  WHERE "id" = ${inventory.id}
  FOR UPDATE
`;

if (lockedInventory.length === 0) {
  throw new NotFoundError("Inventory not found");
}

const currentInventory = lockedInventory[0];

if (!currentInventory) {
  throw new NotFoundError("Inventory not found");
}

const availableQuantity =
  currentInventory.quantity -
  currentInventory.reservedQuantity;

if (quantity > availableQuantity) {
  throw new ConflictError("Insufficient available stock");
}

      const transactionRepository = createInventoryRepository(tx);

      const updatedInventory = await transactionRepository.update(
        inventory.id,
        {
          quantity: {
            decrement: quantity,
          },
        },
      );

      await transactionRepository.createMovement({
        inventory: {
          connect: {
            id: inventory.id,
          },
        },
        type: "STOCK_OUT",
        quantity,
        reason,
      });

      return updatedInventory;
    });
  };

  const getMovements = async (inventoryId: string) => {
    await getById(inventoryId);

    return inventoryRepository.getMovements(inventoryId);
  };

  return {
    initialize,
    getByProductId,
    getById,
    addStock,
    removeStock,
    getMovements,
  };
};

export type InventoryService = ReturnType<typeof createInventoryService>;
