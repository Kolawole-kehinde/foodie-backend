import type { ProductRepository } from "../../catalog/repositories/product.repository.js";
import type { InventoryService } from "../../inventory/services/inventory.service.js";
import type { OutboxService } from "../../outbox/services/outbox.service.js";
import { createOutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import { createOrderCreatedEvent } from "../events/order-event.factory.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

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

type CreateOrderCheckoutServiceDependencies = {
  db: PrismaClient;
  orderRepository: OrderRepository;
  productRepository: ProductRepository;
  inventoryService: InventoryService;
  cartRepository: CartRepository;
  outboxService: OutboxService;
};

export const createOrderCheckoutService = ({
  db,
  productRepository,
  inventoryService,
  outboxService,
}: CreateOrderCheckoutServiceDependencies) => {
  const getReservationExpiresAt = () => {
    return new Date(Date.now() + 15 * 60 * 1000);
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

  return {
    checkoutFromCart,
    buyNow,
  };
};

export type OrderCheckoutService = ReturnType<
  typeof createOrderCheckoutService
>;
