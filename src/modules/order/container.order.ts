import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import type { ProductRepository } from "../catalog/repositories/product.repository.js";
import type { CartRepository } from "../cart/repositories/cart.repository.js";
import type { InventoryService } from "../inventory/services/inventory.service.js";
import { createOrderRepository } from "./repositories/order.repository.js";
import { createOrderService } from "./services/order.service.js";
import { createOrderController } from "./controllers/controller.order.js";
import { createOrderRoute } from "./routes/order.routes.js";

type OrderDependencies = {
  db: PrismaClient;
  productRepository: ProductRepository;
  cartRepository: CartRepository;
  inventoryService: InventoryService;
  authenticate: RequestHandler;
};

export const createOrderContainer = ({
  db,
  productRepository,
  cartRepository,
  inventoryService,
  authenticate,
}: OrderDependencies) => {
  const orderRepository = createOrderRepository(db);

  const orderService = createOrderService({
    db,
    orderRepository,
    productRepository,
    cartRepository,
    inventoryService,
  });

  const orderController = createOrderController({
    orderService,
  });

  const orderRoutes = createOrderRoute({
    orderController,
    authenticate,
  });

  return {
    orderRepository,
    orderService,
    orderController,
    orderRoutes,
  };
};

export type OrderContainer = ReturnType<typeof createOrderContainer>;
