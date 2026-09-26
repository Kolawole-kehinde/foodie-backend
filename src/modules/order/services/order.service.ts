import type { PrismaClient } from "@prisma/client";

import type { OrderRepository } from "../repositories/order.repository.js";
import type { CartRepository } from "../../cart/repositories/cart.repository.js";
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
      const orderItems = [];
      let totalAmount = 0;

      for (const item of cart.items) {
        const product = await productRepository.getProductById(item.productId);

        if (!product) {
          throw new NotFoundError("Product not found");
        }

        if (product.status !== "ACTIVE") {
          throw new ConflictError(`${product.name} is no longer available`);
        }

        const subtotal = Number(product.price) * item.quantity;

        totalAmount += subtotal;

        orderItems.push({
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: item.quantity,
          subtotal,
        });
      }

      
      const reservationExpiresAt = getReservationExpiresAt();

      const order = await orderRepository.create({
        user: {
          connect: {
            id: userId,
          },
        },
        status: "PENDING",
        totalAmount,
        reservationExpiresAt,
      });

      for (const item of orderItems) {
        await inventoryService.reserveStock(
          tx,
          item.productId,
          item.quantity,
          "Order checkout reservation",
          order.id,
        );

        await orderRepository.createOrderItem({
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

      await cartRepository.clearItems(cart.id);

      return orderRepository.getOrderWithItems(order.id);
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

    const subtotal = Number(product.price) * quantity;

    const reservationExpiresAt = getReservationExpiresAt();

    return db.$transaction(async (tx) => {
      const order = await orderRepository.create({
        user: {
          connect: {
            id: userId,
          },
        },
        status: "PENDING",
        totalAmount: subtotal,
        reservationExpiresAt,
      });

      await inventoryService.reserveStock(
        tx,
        productId,
        quantity,
        "Buy now reservation",
        order.id,
      );

      await orderRepository.createOrderItem({
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

      return orderRepository.getOrderWithItems(order.id);
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
      for (const item of order.items) {
        await inventoryService.releaseStock(
          tx,
          item.productId,
          item.quantity,
          "Order cancelled",
          order.id,
        );
      }

      await orderRepository.updateOrderStatus(order.id, {
        status: "CANCELLED",
      });

      return orderRepository.getOrderWithItems(order.id);
    });
  };

  const expireReservations = async () => {
    const expiredOrders = await orderRepository.findExpiredPendingOrders(
      new Date(),
    );

    for (const order of expiredOrders) {
      await db.$transaction(async (tx) => {
        const currentOrder = await orderRepository.getOrderWithItems(order.id);

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

        await orderRepository.updateOrderStatus(currentOrder.id, {
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
