import { OrderStatus } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

import { createOutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import type { InventoryService } from "../../inventory/services/inventory.service.js";
import type { OutboxService } from "../../outbox/services/outbox.service.js";

import {
  createOrderCancelledEvent,
  createOrderConfirmedEvent,
  createOrderDeliveredEvent,
  createOrderExpiredEvent,
  createOrderProcessingEvent,
  createOrderShippedEvent,
} from "../events/order-event.factory.js";

import {
  createOrderRepository,
  type OrderRepository,
} from "../repositories/order.repository.js";

import { canTransitionOrderStatus } from "../policies/order-status-transition.policy.js";

type CreateOrderManagementServiceDependencies = {
  db: PrismaClient;
  orderRepository: OrderRepository;
  inventoryService: InventoryService;
  outboxService: OutboxService;
};

export const createOrderManagementService = ({
  db,
  orderRepository,
  inventoryService,
  outboxService,
}: CreateOrderManagementServiceDependencies) => {
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

   const confirmOrderFromPayment = async (orderId: string) => {
  return db.$transaction(async (tx) => {
    const transactionOrderRepository = createOrderRepository(tx);
    const transactionOutboxRepository = createOutboxRepository(tx);

    const currentOrder =
      await transactionOrderRepository.getByIdForUpdate(orderId);

    if (!currentOrder) {
      throw new NotFoundError("Order not found");
    }

    const currentStatus = currentOrder.status as OrderStatus;

    // Payment success events can be delivered more than once.
    // If the order is already confirmed, treat the duplicate
    // event as successfully processed.
    if (currentStatus === OrderStatus.CONFIRMED) {
      return {
        order: await transactionOrderRepository.getOrderWithItems(orderId),
        action: "ALREADY_CONFIRMED" as const,
      };
    }

    // The payment succeeded after the inventory reservation expired.
    // Do not confirm the order because the stock may already have
    // been released and sold to another customer.
    if (currentStatus === OrderStatus.EXPIRED) {
      return {
        order: await transactionOrderRepository.getOrderWithItems(orderId),
        action: "REFUND_REQUIRED" as const,
      };
    }

    if (currentStatus !== OrderStatus.PENDING) {
      throw new ConflictError(
        `Order cannot be confirmed from ${currentStatus}`,
      );
    }

    await transactionOrderRepository.updateStatus(orderId, {
      status: OrderStatus.CONFIRMED,
    });

    const event = createOrderConfirmedEvent({
      orderId: currentOrder.id,
      userId: currentOrder.userId,
      previousStatus: currentStatus,
      newStatus: OrderStatus.CONFIRMED,
    });

    await outboxService.createEvent({
      event,
      repository: transactionOutboxRepository,
    });

    return {
      order: await transactionOrderRepository.getOrderWithItems(orderId),
      action: "CONFIRMED" as const,
    };
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

  const confirmOrder = (orderId: string) =>
    changeOrderStatus(orderId, OrderStatus.CONFIRMED);

  const processOrder = (orderId: string) =>
    changeOrderStatus(orderId, OrderStatus.PROCESSING);

  const shipOrder = (orderId: string) =>
    changeOrderStatus(orderId, OrderStatus.SHIPPED);

  const deliverOrder = (orderId: string) =>
    changeOrderStatus(orderId, OrderStatus.DELIVERED);

  return {
    getMyOrders,
    getMyOrderById,
    cancelOrder,
    expireReservations,
    confirmOrder,
    confirmOrderFromPayment,
    processOrder,
    shipOrder,
    deliverOrder,
  };
};

export type OrderManagementService = ReturnType< typeof createOrderManagementService>;
