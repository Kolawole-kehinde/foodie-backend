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

describe("Order buy now integration tests", () => {
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

  it("creates an order and reserves inventory when buying a product directly", async () => {
    const user = await createTestUser("buy-now");
    userId = user.id;

    const category = await createTestCategory("buy-now");
    categoryId = category.id;

    const product = await createTestProduct({
      categoryId: category.id,
      suffix: "buy-now",
      price: "2000.00",
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
      3,
    );

    expect(order).toBeDefined();
    expect(order.userId).toBe(user.id);
    expect(order.status).toBe("PENDING");
    expect(order.totalAmount.toString()).toBe("6000");

    expect(order.items).toHaveLength(1);

    expect(order.items[0]).toMatchObject({
      productId: product.id,
      productName: product.name,
      quantity: 3,
    });

    expect(order.items[0].unitPrice.toString()).toBe("2000");
    expect(order.items[0].subtotal.toString()).toBe("6000");

    const inventory = await prisma.inventory.findUnique({
      where: {
        productId: product.id,
      },
    });

    expect(inventory?.quantity).toBe(10);
    expect(inventory?.reservedQuantity).toBe(3);

    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateType: "order",
        aggregateId: order.id,
        eventType: "order.created.v1",
      },
    });

    expect(outboxEvent).not.toBeNull();
  });

  it("rolls back buy now when inventory is insufficient", async () => {
    const user = await createTestUser("buy-now-insufficient");
    userId = user.id;

    const category = await createTestCategory("buy-now-insufficient");
    categoryId = category.id;

    const product = await createTestProduct({
      categoryId: category.id,
      suffix: "buy-now-insufficient",
      price: "2000.00",
      status: "ACTIVE",
    });
    productId = product.id;

    await createTestInventory({
      productId: product.id,
      quantity: 2,
    });

    await expect(
      orderService.buyNow(
        user.id,
        product.id,
        3,
      ),
    ).rejects.toThrow();

    const orders = await prisma.order.findMany({
      where: {
        userId: user.id,
      },
    });

    expect(orders).toHaveLength(0);

    const inventory = await prisma.inventory.findUnique({
      where: {
        productId: product.id,
      },
    });

    expect(inventory?.quantity).toBe(2);
    expect(inventory?.reservedQuantity).toBe(0);

    const orderItems = await prisma.orderItem.findMany({
      where: {
        order: {
          userId: user.id,
        },
      },
    });

    expect(orderItems).toHaveLength(0);

    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        aggregateType: "order",
      },
    });

    expect(
      outboxEvents.some(
        (event) =>
          event.eventType === "order.created.v1",
      ),
    ).toBe(false);
  });
});