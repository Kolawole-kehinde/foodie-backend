import { prisma } from "../../../../src/database/prisma/client.js";

export const createTestUser = async (suffix: string) => {
  return prisma.user.create({
    data: {
      email: `order-test-${Date.now()}-${suffix}@example.com`,
      passwordHash: "integration-test-password",
      status: "ACTIVE",
    },
  });
};

export const createTestCategory = async (suffix: string) => {
  return prisma.category.create({
    data: {
      name: `order-test-${Date.now()}-${suffix}`,
      slug: `order-test-${Date.now()}-${suffix}`,
    },
  });
};

type CreateTestProductInput = {
  categoryId: string;
  suffix: string;
  price?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
};

export const createTestProduct = async ({
  categoryId,
  suffix,
  price = "1500.00",
  status = "ACTIVE",
}: CreateTestProductInput) => {
  return prisma.product.create({
    data: {
      categoryId,
      name: `order-test-${Date.now()}-${suffix}`,
      slug: `order-test-${Date.now()}-${suffix}`,
      description: "Order integration test product",
      price,
      status,
    },
  });
};

type CreateTestInventoryInput = {
  productId: string;
  quantity?: number;
  reservedQuantity?: number;
  lowStockThreshold?: number;
};

export const createTestInventory = async ({
  productId,
  quantity = 10,
  reservedQuantity = 0,
  lowStockThreshold = 5,
}: CreateTestInventoryInput) => {
  return prisma.inventory.create({
    data: {
      productId,
      quantity,
      reservedQuantity,
      lowStockThreshold,
    },
  });
};

export const createTestCart = async (userId: string) => {
  return prisma.cart.create({
    data: {
      userId,
    },
  });
};

type CreateTestCartItemInput = {
  cartId: string;
  productId: string;
  quantity: number;
};

export const createTestCartItem = async ({
  cartId,
  productId,
  quantity,
}: CreateTestCartItemInput) => {
  return prisma.cartItem.create({
    data: {
      cartId,
      productId,
      quantity,
    },
  });
};

export const cleanupOrderTestData = async ({
  userIds = [],
  cartIds = [],
  productIds = [],
  categoryIds = [],
}: {
  userIds?: string[];
  cartIds?: string[];
  productIds?: string[];
  categoryIds?: string[];
}) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const uniqueCartIds = [...new Set(cartIds.filter(Boolean))];
  const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
  const uniqueCategoryIds = [...new Set(categoryIds.filter(Boolean))];

  let orderIds: string[] = [];

  if (uniqueUserIds.length > 0) {
    const orders = await prisma.order.findMany({
      where: {
        userId: {
          in: uniqueUserIds,
        },
      },
      select: {
        id: true,
      },
    });

    orderIds = orders.map((order) => order.id);
  }

  if (orderIds.length > 0) {
    await prisma.outboxEvent.deleteMany({
      where: {
        aggregateType: "order",
        aggregateId: {
          in: orderIds,
        },
      },
    });

    await prisma.orderItem.deleteMany({
      where: {
        orderId: {
          in: orderIds,
        },
      },
    });

    await prisma.order.deleteMany({
      where: {
        id: {
          in: orderIds,
        },
      },
    });
  }

  if (uniqueCartIds.length > 0) {
    await prisma.cartItem.deleteMany({
      where: {
        cartId: {
          in: uniqueCartIds,
        },
      },
    });

    await prisma.cart.deleteMany({
      where: {
        id: {
          in: uniqueCartIds,
        },
      },
    });
  }

  if (uniqueProductIds.length > 0) {
    await prisma.inventoryMovement.deleteMany({
      where: {
        inventory: {
          productId: {
            in: uniqueProductIds,
          },
        },
      },
    });

    await prisma.inventory.deleteMany({
      where: {
        productId: {
          in: uniqueProductIds,
        },
      },
    });

    await prisma.product.deleteMany({
      where: {
        id: {
          in: uniqueProductIds,
        },
      },
    });
  }

  if (uniqueCategoryIds.length > 0) {
    await prisma.category.deleteMany({
      where: {
        id: {
          in: uniqueCategoryIds,
        },
      },
    });
  }

  if (uniqueUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: uniqueUserIds,
        },
      },
    });
  }
};