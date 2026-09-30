import { Prisma, OrderStatus } from "@prisma/client";
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
import type { OutboxService } from "../../outbox/services/outbox.service.js";

import { createOutboxRepository } from "../../outbox/repositories/outbox.repository.js";

import {
  createOrderCancelledEvent,
  createOrderConfirmedEvent,
  createOrderCreatedEvent,
  createOrderDeliveredEvent,
  createOrderExpiredEvent,
  createOrderProcessingEvent,
  createOrderShippedEvent,
} from "../events/order-event.factory.js";

import { canTransitionOrderStatus } from "../policies/order-status-transition.policy.js";

import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

type CreateOrderServiceDependencies = {
  db: PrismaClient;
  orderRepository: OrderRepository;
  productRepository: ProductRepository;
  inventoryService: InventoryService;
  cartRepository: CartRepository;
  outboxService: OutboxService;
};

export const createOrderService = ({
  db,
  orderRepository,
  productRepository,
  inventoryService,
  cartRepository,
  outboxService,
}: CreateOrderServiceDependencies) => {
  const getReservationExpiresAt = () => {
    return new Date(Date.now() + 15 * 60 * 1000);
  };

  /*
   * Creates the correct status event for the transition.
   */
  const createStatusEvent = (
    orderId: string,
    userId: string,
    previousStatus: OrderStatus,
    newStatus: OrderStatus,
  ) => {
    const input = {
      orderId,
      userId,
      previousStatus,
      newStatus,
    };

    switch (newStatus) {
      case OrderStatus.CONFIRMED:
        return createOrderConfirmedEvent(input);

      case OrderStatus.PROCESSING:
        return createOrderProcessingEvent(input);

      case OrderStatus.SHIPPED:
        return createOrderShippedEvent(input);

      case OrderStatus.DELIVERED:
        return createOrderDeliveredEvent(input);

      default:
        throw new ConflictError(
          `Unsupported status transition to ${newStatus}`,
        );
    }
  };

  /*
   * Generic status transition.
   *
   * The caller is responsible for authorization.
   * This function is responsible for the business transition itself.
   */
  const changeOrderStatus = async (orderId: string, newStatus: OrderStatus) => {
    return db.$transaction(async (tx) => {
      const transactionOrderRepository = createOrderRepository(tx);
      const transactionOutboxRepository = createOutboxRepository(tx);

      const currentOrder =
        await transactionOrderRepository.getByIdForUpdate(orderId);

      if (!currentOrder) {
        throw new NotFoundError("Order not found");
      }

      const currentStatus = currentOrder.status as OrderStatus;

      if (!canTransitionOrderStatus(currentStatus, newStatus)) {
        throw new ConflictError(
          `Order cannot transition from ${currentStatus} to ${newStatus}`,
        );
      }

      await transactionOrderRepository.updateStatus(orderId, {
        status: newStatus,
      });

      const event = createStatusEvent(
        currentOrder.id,
        currentOrder.userId,
        currentStatus,
        newStatus,
      );

      await outboxService.createEvent({
        event,
        repository: transactionOutboxRepository,
      });

      return transactionOrderRepository.getOrderWithItems(orderId);
    });
  };

  const checkoutFromCart = async (userId: string) => {
    return db.$transaction(async (tx) => {
      const transactionOrderRepository = createOrderRepository(tx);
      const transactionCartRepository = createCartRepository(tx);
      const transactionOutboxRepository = createOutboxRepository(tx);

      const cart = await transactionCartRepository.getByUserIdWithItems(userId);

      if (!cart) {
        throw new NotFoundError("Cart not found");
      }

      if (cart.items.length === 0) {
        throw new ConflictError("Cart is empty");
      }

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
        status: OrderStatus.PENDING,
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

      const event = createOrderCreatedEvent({
        orderId: order.id,
        userId,
        totalAmount: totalAmount.toString(),
        items: orderItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          unitPrice: item.unitPrice.toString(),
          quantity: item.quantity,
          subtotal: item.subtotal.toString(),
        })),
      });

      await outboxService.createEvent({
        event,
        repository: transactionOutboxRepository,
      });

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
      const transactionOutboxRepository = createOutboxRepository(tx);

      const order = await transactionOrderRepository.create({
        user: {
          connect: {
            id: userId,
          },
        },
        status: OrderStatus.PENDING,
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

      const event = createOrderCreatedEvent({
        orderId: order.id,
        userId,
        totalAmount: subtotal.toString(),
        items: [
          {
            productId: product.id,
            productName: product.name,
            unitPrice: product.price.toString(),
            quantity,
            subtotal: subtotal.toString(),
          },
        ],
      });

      await outboxService.createEvent({
        event,
        repository: transactionOutboxRepository,
      });

      return transactionOrderRepository.getOrderWithItems(order.id);
    });
  };

  const getMyOrders = async (userId: string) => {
    return orderRepository.getUserOrders(userId);
  };

  const getMyOrderById = async (userId: string, orderId: string) => {
    const order = await orderRepository.getUserOrderById(userId, orderId);

    if (!order) {
      throw new NotFoundError("Order not found");
    }

    return order;
  };

  const cancelOrder = async (userId: string, orderId: string) => {
    return db.$transaction(async (tx) => {
      const transactionOrderRepository = createOrderRepository(tx);
      const transactionOutboxRepository = createOutboxRepository(tx);

      const currentOrder =
        await transactionOrderRepository.getByIdForUpdate(orderId);

      if (!currentOrder || currentOrder.userId !== userId) {
        throw new NotFoundError("Order not found");
      }

      const currentStatus = currentOrder.status as OrderStatus;

      if (!canTransitionOrderStatus(currentStatus, OrderStatus.CANCELLED)) {
        throw new ConflictError("Order cannot be cancelled");
      }

      const orderWithItems =
        await transactionOrderRepository.getOrderWithItems(orderId);

      if (!orderWithItems) {
        throw new NotFoundError("Order not found");
      }

      for (const item of orderWithItems.items) {
        await inventoryService.releaseStock(
          tx,
          item.productId,
          item.quantity,
          "Order cancelled",
          orderWithItems.id,
        );
      }

      await transactionOrderRepository.updateStatus(orderWithItems.id, {
        status: OrderStatus.CANCELLED,
      });

      const event = createOrderCancelledEvent({
        orderId: orderWithItems.id,
        userId: orderWithItems.userId,
        totalAmount: orderWithItems.totalAmount.toString(),
      });

      await outboxService.createEvent({
        event,
        repository: transactionOutboxRepository,
      });

      return transactionOrderRepository.getOrderWithItems(orderWithItems.id);
    });
  };

  const expireReservations = async () => {
    const now = new Date();

    const expiredOrders = await orderRepository.findExpiredPendingOrders(now);

    let expiredCount = 0;

    for (const order of expiredOrders) {
      const expired = await db.$transaction(async (tx) => {
        const transactionOrderRepository = createOrderRepository(tx);

        const transactionOutboxRepository = createOutboxRepository(tx);

        const currentOrder = await transactionOrderRepository.getByIdForUpdate(
          order.id,
        );

        if (!currentOrder) {
          return false;
        }

        const currentStatus = currentOrder.status as OrderStatus;

        if (
          currentStatus !== OrderStatus.PENDING ||
          !currentOrder.reservationExpiresAt ||
          currentOrder.reservationExpiresAt > now
        ) {
          return false;
        }

        const orderWithItems =
          await transactionOrderRepository.getOrderWithItems(order.id);

        if (!orderWithItems) {
          return false;
        }

        for (const item of orderWithItems.items) {
          await inventoryService.releaseStock(
            tx,
            item.productId,
            item.quantity,
            "Reservation expired",
            orderWithItems.id,
          );
        }

        await transactionOrderRepository.updateStatus(orderWithItems.id, {
          status: OrderStatus.EXPIRED,
        });

        const event = createOrderExpiredEvent({
          orderId: orderWithItems.id,
          userId: orderWithItems.userId,
          totalAmount: orderWithItems.totalAmount.toString(),
        });

        await outboxService.createEvent({
          event,
          repository: transactionOutboxRepository,
        });

        return true;
      });

      if (expired) {
        expiredCount++;
      }
    }

    return { expiredCount };
  };

  const confirmOrder = async (orderId: string) => {
    return changeOrderStatus(orderId, OrderStatus.CONFIRMED);
  };

  const processOrder = async (orderId: string) => {
    return changeOrderStatus(orderId, OrderStatus.PROCESSING);
  };

  const shipOrder = async (orderId: string) => {
    return changeOrderStatus(orderId, OrderStatus.SHIPPED);
  };

  const deliverOrder = async (orderId: string) => {
    return changeOrderStatus(orderId, OrderStatus.DELIVERED);
  };

  return {
    checkoutFromCart,
    buyNow,
    getMyOrders,
    getMyOrderById,
    cancelOrder,
    expireReservations,
    confirmOrder,
    processOrder,
    shipOrder,
    deliverOrder,
  };
};

export type OrderService = ReturnType<typeof createOrderService>;
