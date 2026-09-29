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
  createTestCart,
  createTestCartItem,
  createTestCategory,
  createTestInventory,
  createTestProduct,
  createTestUser,
} from "./helpers/order-test.helpers.js";

describe("Order checkout integration tests", () => {
  let userId = "";
  let categoryId = "";
  let productId = "";
  let cartId = "";

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
      cartIds: [cartId],
      productIds: [productId],
      categoryIds: [categoryId],
    });

    userId = "";
    categoryId = "";
    productId = "";
    cartId = "";
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("checks out a cart and reserves inventory", async () => {
    const user = await createTestUser("checkout");
    userId = user.id;

    const category = await createTestCategory("checkout");
    categoryId = category.id;

    const product = await createTestProduct({
      categoryId: category.id,
      suffix: "checkout",
      price: "1500.00",
      status: "ACTIVE",
    });
    productId = product.id;

    await createTestInventory({
      productId: product.id,
      quantity: 10,
    });

    const cart = await createTestCart(user.id);
    cartId = cart.id;

    await createTestCartItem({
      cartId: cart.id,
      productId: product.id,
      quantity: 2,
    });

    const order = await orderService.checkoutFromCart(user.id);

    expect(order).toBeDefined();
    expect(order.userId).toBe(user.id);
    expect(order.status).toBe("PENDING");
    expect(order.totalAmount.toString()).toBe("3000");

    expect(order.items).toHaveLength(1);

    expect(order.items[0]).toMatchObject({
      productId: product.id,
      productName: product.name,
      quantity: 2,
    });

    expect(order.items[0].subtotal.toString()).toBe("3000");

    const inventory = await prisma.inventory.findUnique({
      where: {
        productId: product.id,
      },
    });

    expect(inventory?.quantity).toBe(10);
    expect(inventory?.reservedQuantity).toBe(2);

    const remainingCartItems = await prisma.cartItem.findMany({
      where: {
        cartId: cart.id,
      },
    });

    expect(remainingCartItems).toHaveLength(0);

    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        aggregateType: "order",
        aggregateId: order.id,
        eventType: "order.created.v1",
      },
    });

    expect(outboxEvent).not.toBeNull();
  });



  it("rolls back checkout when inventory is insufficient", async () => {
  const user = await createTestUser("checkout-insufficient");
  userId = user.id;

  const category = await createTestCategory("checkout-insufficient");
  categoryId = category.id;

  const product = await createTestProduct({
    categoryId: category.id,
    suffix: "checkout-insufficient",
    price: "1500.00",
    status: "ACTIVE",
  });
  productId = product.id;

  await createTestInventory({
    productId: product.id,
    quantity: 1,
  });

  const cart = await createTestCart(user.id);
  cartId = cart.id;

  await createTestCartItem({
    cartId: cart.id,
    productId: product.id,
    quantity: 2,
  });

  await expect(
    orderService.checkoutFromCart(user.id),
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

  expect(inventory?.quantity).toBe(1);
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
    outboxEvents.some((event) => event.eventType === "order.created.v1"),
  ).toBe(false);

  const cartItems = await prisma.cartItem.findMany({
    where: {
      cartId: cart.id,
    },
  });

  expect(cartItems).toHaveLength(1);
  expect(cartItems[0].quantity).toBe(2);
});
});