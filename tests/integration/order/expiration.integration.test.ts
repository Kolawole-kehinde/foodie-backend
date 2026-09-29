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

describe("Order expiration integration tests", () => {
  let userId = "";
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
      userIds: [userId],
      productIds: [productId],
      categoryIds: [categoryId],
    });

    userId = "";
    categoryId = "";
    productId = "";
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("expires a pending order and releases reserved inventory", async () => {
    const user = await createTestUser("expiration");
    userId = user.id;

    const category = await createTestCategory("expiration");
    categoryId = category.id;

    const product = await createTestProduct({
      categoryId: category.id,
      suffix: "expiration",
      price: "1500.00",
      status: "ACTIVE",
    });
    productId = product.id;

    await createTestInventory({
      productId: product.id,
      quantity: 10,
    });

    const order = await orderService.buyNow(
      user.id,
      product.id,
      2,
    );

    await prisma.order.update({
      where: {
        id: order.id,
      },
      data: {
        reservationExpiresAt: new Date(Date.now() - 1_000),
      },
    });

    const result = await orderService.expireReservations();

    expect(result.expiredCount).toBe(1);

    const expiredOrder = await prisma.order.findUnique({
      where: {
        id: order.id,
      },
    });

    expect(expiredOrder?.status).toBe("EXPIRED");

    const inventory = await prisma.inventory.findUnique({
      where: {
        productId: product.id,
      },
    });

    expect(inventory?.quantity).toBe(10);
    expect(inventory?.reservedQuantity).toBe(0);

    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateType: "order",
        aggregateId: order.id,
        eventType: "order.expired.v1",
      },
    });

    expect(outboxEvent).not.toBeNull();
  });
});
