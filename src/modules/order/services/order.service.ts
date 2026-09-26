import { Prisma } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import {
  createOrderRepository,
  type OrderRepository,
} from "../repositories/order.repository.js";

import {
  createCartRepository,
  type CartRepository,
} from "../../cart/repositories/cart.repository.js";
import type { ProductRepository } from "../../catalog/repositories/product.repository.js";
import type { InventoryService } from "../../inventory/services/inventory.service.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

type CreateOrderServiceDependencies = {
  db: PrismaClient;
  orderRepository: OrderRepository;
  cartRepository: CartRepository;
  productRepository: ProductRepository;
  inventoryService: InventoryService;
};

export const createOrderService = ({
  db,
  orderRepository,
  cartRepository,
  productRepository,
  inventoryService,
}: CreateOrderServiceDependencies) => {
  const getReservationExpiresAt = () => {
    return new Date(Date.now() + 15 * 60 * 1000);
  };

  const checkoutFromCart = async (userId: string) => {
    const cart = await cartRepository.getByUserIdWithItems(userId);

    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    if (cart.items.length === 0) {
      throw new ConflictError("Cart is empty");
    }

    return db.$transaction(async (tx) => {
      // All database writes inside this transaction use tx.
      const transactionOrderRepository = createOrderRepository(tx);
      const transactionCartRepository = createCartRepository(tx);

      const orderItems: {
        productId: string;
        productName: string;
        unitPrice: Prisma.Decimal;
        quantity: number;
        subtotal: Prisma.Decimal;
      }[] = [];

      let totalAmount = new Prisma.Decimal(0);

      for (const item of cart.items) {
        const product = await productRepository.getProductById(item.productId);

        if (!product) {
          throw new NotFoundError("Product not found");
        }

        if (product.status !== "ACTIVE") {
          throw new ConflictError(`${product.name} is no longer available`);
        }

        const subtotal = product.price.mul(item.quantity);

        totalAmount = totalAmount.add(subtotal);

        orderItems.push({
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
          subtotal,
        });
      }

      const order = await transactionOrderRepository.create({
        user: {
          connect: {
            id: userId,
          },
        },
        status: "PENDING",
        totalAmount,
        reservationExpiresAt: getReservationExpiresAt(),
      });

      for (const item of orderItems) {
        await inventoryService.reserveStock(
          tx,
          item.productId,
          item.quantity,
          "Order checkout reservation",
          order.id,
        );

        await transactionOrderRepository.createOrderItem({
          order: {
            connect: {
              id: order.id,
            },
          },
          product: {
            connect: {
              id: item.productId,
            },
          },
          productName: item.productName,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
        });
      }

      await transactionCartRepository.clearItems(cart.id);

      return transactionOrderRepository.getOrderWithItems(order.id);
    });
  };

  const buyNow = async (
    userId: string,
    productId: string,
    quantity: number,
  ) => {
    if (quantity <= 0) {
      throw new ConflictError("Quantity must be greater than zero");
    }

    const product = await productRepository.getProductById(productId);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.status !== "ACTIVE") {
      throw new ConflictError("Product is not available");
    }

    const subtotal = product.price.mul(quantity);

    return db.$transaction(async (tx) => {
      const transactionOrderRepository = createOrderRepository(tx);

      const order = await transactionOrderRepository.create({
        user: {
          connect: {
            id: userId,
          },
        },
        status: "PENDING",
        totalAmount: subtotal,
        reservationExpiresAt: getReservationExpiresAt(),
      });

      await inventoryService.reserveStock(
        tx,
        productId,
        quantity,
        "Buy now reservation",
        order.id,
      );

      await transactionOrderRepository.createOrderItem({
        order: {
          connect: {
            id: order.id,
          },
        },
        product: {
          connect: {
            id: productId,
          },
        },
        productName: product.name,
        unitPrice: product.price,
        quantity,
        subtotal,
      });

      return transactionOrderRepository.getOrderWithItems(order.id);
    });
  };

  const getMyOrders = async (userId: string) => {
    return orderRepository.getUserAllOrder(userId);
  };

  const getMyOrderById = async (userId: string, orderId: string) => {
    const order = await orderRepository.getUserOrderById(userId, orderId);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    return order;
  };

  const cancelOrder = async (userId: string, orderId: string) => {
    const order = await orderRepository.getOrderWithItems(orderId);

    if (!order || order.userId !== userId) {
      throw new NotFoundError("Order not found");
    }

    if (order.status !== "PENDING" && order.status !== "CONFIRMED") {
      throw new ConflictError("Order cannot be cancelled");
    }

    return db.$transaction(async (tx) => {
      const transactionOrderRepository = createOrderRepository(tx);

      // Re-read the order inside the transaction so we don't
      // operate on stale status information.
      const currentOrder =
        await transactionOrderRepository.getOrderWithItems(orderId);

      if (!currentOrder || currentOrder.userId !== userId) {
        throw new NotFoundError("Order not found");
      }

      if (
        currentOrder.status !== "PENDING" &&
        currentOrder.status !== "CONFIRMED"
      ) {
        throw new ConflictError("Order cannot be cancelled");
      }

      for (const item of currentOrder.items) {
        await inventoryService.releaseStock(
          tx,
          item.productId,
          item.quantity,
          "Order cancelled",
          currentOrder.id,
        );
      }

      await transactionOrderRepository.updateOrderStatus(currentOrder.id, {
        status: "CANCELLED",
      });

      return transactionOrderRepository.getOrderWithItems(currentOrder.id);
    });
  };

  const expireReservations = async () => {
    const expiredOrders = await orderRepository.findExpiredPendingOrders(
      new Date(),
    );

    for (const order of expiredOrders) {
      await db.$transaction(async (tx) => {
        const transactionOrderRepository = createOrderRepository(tx);

        const currentOrder = await transactionOrderRepository.getOrderWithItems(
          order.id,
        );

        if (!currentOrder) {
          return;
        }

        if (currentOrder.status !== "PENDING") {
          return;
        }

        if (
          !currentOrder.reservationExpiresAt ||
          currentOrder.reservationExpiresAt > new Date()
        ) {
          return;
        }

        for (const item of currentOrder.items) {
          await inventoryService.releaseStock(
            tx,
            item.productId,
            item.quantity,
            "Reservation expired",
            currentOrder.id,
          );
        }

        await transactionOrderRepository.updateOrderStatus(currentOrder.id, {
          status: "EXPIRED",
        });
      });
    }
  };

  return {
    checkoutFromCart,
    buyNow,
    getMyOrders,
    getMyOrderById,
    cancelOrder,
    expireReservations,
  };
};

export type OrderService = ReturnType<typeof createOrderService>;
