import type { PrismaClient } from "@prisma/client";
import type { RequestHandler } from "express";
import type { ProductRepository } from "../catalog/repositories/product.repository.js";
import type { CartRepository } from "../cart/repositories/cart.repository.js";
import type { InventoryService } from "../inventory/services/inventory.service.js";
import { createOrderRepository } from "./repositories/order.repository.js";
import { createOrderService } from "./services/order.service.js";
import { createOrderController } from "./controllers/controller.order.js";
import { createOrderRoutes } from "./routes/order.routes.js";
import type { OutboxService } from "../outbox/services/outbox.service.js";

type OrderDependencies = {
  db: PrismaClient;
  productRepository: ProductRepository;
  cartRepository: CartRepository;
  inventoryService: InventoryService;
  outboxService: OutboxService;
  authenticate: RequestHandler;
};

export const createOrderDependencies = ({
  db,
  productRepository,
  cartRepository,
  inventoryService,
  outboxService,
  authenticate,
}: OrderDependencies) => {
  const orderRepository = createOrderRepository(db);

  const orderService = createOrderService({
    db,
    orderRepository,
    productRepository,
    cartRepository,
    inventoryService,
    outboxService
  });

  const orderController = createOrderController({
    orderService,
  });

  const orderRoutes = createOrderRoutes({
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

export type OrderContainer = ReturnType<typeof createOrderDependencies>;
