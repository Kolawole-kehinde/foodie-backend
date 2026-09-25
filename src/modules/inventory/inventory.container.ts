import type { DatabaseClient } from "../../database/prisma/types.js";
import type { RequestHandler } from "express";
import { createInventoryRepository } from "./repositories/inventory.repositories.js";
import { createInventoryService } from "./services/inventory.service.js";
import { createInventoryController } from "./controllers/inventory.controller.js";
import { createInventoryRoutes } from "./routes/inventory.routes.js";
import type { ProductRepository } from "../catalog/repositories/product.repository.js";
import type { PrismaClient } from "@prisma/client";

type InventoryDependencies = {
  db: PrismaClient;
  productRepository: ProductRepository;
  authenticate: RequestHandler;
  authorizePermission: (permission: string) => RequestHandler;
};

export const createInventoryDependencies = ({
  db,
  productRepository,
  authenticate,
  authorizePermission,
}: InventoryDependencies) => {
    
  const inventoryRepository = createInventoryRepository(db);
  

  const inventoryService = createInventoryService({
    db,
    inventoryRepository,
    productRepository,
  });

  const inventoryController = createInventoryController({
    inventoryService,
  });

  const inventoryRoutes = createInventoryRoutes({
    inventoryController,
    authenticate,
    authorizePermission,
  });

  return {
    inventoryRoutes,
  };
};