import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { prisma } from "../../../src/database/prisma/client.js";

import { createProductRepository } from "../../../src/modules/catalog/repositories/product.repository.js";
import { createCartRepository } from "../../../src/modules/cart/repositories/cart.repository.js";
import { createInventoryRepository } from "../../../src/modules/inventory/repositories/inventory.repositories.js";
import { createInventoryService } from "../../../src/modules/inventory/services/inventory.service.js";
import { createOutboxRepository } from "../../../src/modules/outbox/repositories/outbox.repository.js";
import { createOutboxService } from "../../../src/modules/outbox/services/outbox.service.js";
import { createOrderRepository } from "../../../src/modules/order/repositories/order.repository.js";
import { createOrderService } from "../../../src/modules/order/services/order.service.js";

import {
  cleanupOrderTestData,
  createTestCategory,
  createTestInventory,
  createTestProduct,
  createTestUser,
} from "./helpers/order-test.helpers.js";

describe("Order ownership integration tests", () => {
  let userId = "";
  let otherUserId = "";
  let categoryId = "";
  let productId = "";

  const productRepository = createProductRepository(prisma);
  const cartRepository = createCartRepository(prisma);
  const inventoryRepository = createInventoryRepository(prisma);
  const outboxRepository = createOutboxRepository(prisma);

  const inventoryService = createInventoryService({
    db: prisma,
    inventoryRepository,
    productRepository,
  });

  const outboxService = createOutboxService({
    outboxRepository,
  });

  const orderRepository = createOrderRepository(prisma);

  const orderService = createOrderService({
    db: prisma,
    orderRepository,
    productRepository,
    cartRepository,
    inventoryService,
    outboxService,
  });

  beforeAll(async () => {
    await prisma.$connect();
  });

  afterEach(async () => {
    await cleanupOrderTestData({
      userIds: [userId, otherUserId],
      productIds: [productId],
      categoryIds: [categoryId],
    });

    userId = "";
    otherUserId = "";
    categoryId = "";
    productId = "";
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns only the user's own orders and prevents access to another user's order", async () => {
    const user = await createTestUser("ownership");
    userId = user.id;

    const otherUser = await createTestUser("ownership-other");
    otherUserId = otherUser.id;

    const category = await createTestCategory("ownership");
    categoryId = category.id;

    const product = await createTestProduct({
      categoryId: category.id,
      suffix: "ownership",
      price: "1500.00",
      status: "ACTIVE",
    });
    productId = product.id;

    await createTestInventory({
      productId: product.id,
      quantity: 10,
    });

    const userOrder = await orderService.buyNow(
      user.id,
      product.id,
      2,
    );

    const otherUserOrder = await orderService.buyNow(
      otherUser.id,
      product.id,
      1,
    );

    const userOrders = await orderService.getMyOrders(user.id);

    expect(userOrders).toHaveLength(1);
    expect(userOrders[0].id).toBe(userOrder.id);
    expect(userOrders[0].userId).toBe(user.id);

    const otherUserOrders = await orderService.getMyOrders(
      otherUser.id,
    );

    expect(otherUserOrders).toHaveLength(1);
    expect(otherUserOrders[0].id).toBe(otherUserOrder.id);
    expect(otherUserOrders[0].userId).toBe(otherUser.id);

    await expect(
      orderService.getMyOrderById(
        user.id,
        otherUserOrder.id,
      ),
    ).rejects.toThrow("Order not found");

    await expect(
      orderService.getMyOrderById(
        otherUser.id,
        userOrder.id,
      ),
    ).rejects.toThrow("Order not found");
  });
});