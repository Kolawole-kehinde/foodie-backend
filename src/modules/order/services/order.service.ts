import type { OrderRepository } from "../repositories/order.repository.js";
import type { ProductRepository } from "../../catalog/repositories/product.repository.js";
import type { InventoryService } from "../../inventory/services/inventory.service.js";
import type { CartRepository } from "../../cart/repositories/cart.repository.js";
import type { OutboxService } from "../../outbox/services/outbox.service.js";
import type { PrismaClient } from "@prisma/client";
import {
  createOrderCheckoutService,
  type OrderCheckoutService,
} from "./order-checkout.service.js";
import {
  createOrderManagementService,
  type OrderManagementService,
} from "./order-management.service.js";

type CreateOrderServiceDependencies = {
  db: PrismaClient;
  orderRepository: OrderRepository;
  productRepository: ProductRepository;
  inventoryService: InventoryService;
  cartRepository: CartRepository;
  outboxService: OutboxService;
};

export const createOrderService = (dependencies: CreateOrderServiceDependencies,) => {

  const checkoutService = createOrderCheckoutService(dependencies);

  const managementService =  createOrderManagementService({
      db: dependencies.db,
      orderRepository: dependencies.orderRepository,
      inventoryService: dependencies.inventoryService,
      outboxService: dependencies.outboxService,
    });

  return {
    ...checkoutService,
    ...managementService,
  };
};

export type OrderService = ReturnType<typeof createOrderService>;
