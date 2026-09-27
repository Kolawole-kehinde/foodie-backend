import type { RequestHandler } from "express";
import type { OrderService } from "../services/order.service.js";

import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";

type CreateOrderControllerDependencies = {
  orderService: OrderService;
};

export type OrderController = {
  checkout: RequestHandler;
  buyNow: RequestHandler;
  getMyOrders: RequestHandler;
  getMyOrderById: RequestHandler;
  cancelOrder: RequestHandler;
};

export const createOrderController = ({
  orderService,
}: CreateOrderControllerDependencies): OrderController => {
  const checkout = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const createdOrder =
      await orderService.checkoutFromCart(userId);

    res.status(201).json({
      success: true,
      data: createdOrder,
    });
  });

  const buyNow = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const { productId, quantity } = req.body;

    const createdOrder = await orderService.buyNow(
      userId,
      productId,
      quantity,
    );

    res.status(201).json({
      success: true,
      data: createdOrder,
    });
  });



  const getMyOrders = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const orders = await orderService.getMyOrders(userId);

    res.status(200).json({
      success: true,
      data: orders,
    });
  });

  const getMyOrderById = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { orderId } = req.params;

    if (typeof orderId !== "string" || !orderId) {
      throw new BadRequestError("Order ID is required");
    }

    const order = await orderService.getMyOrderById(
      userId,
      orderId,
    );

    res.status(200).json({
      success: true,
      data: order,
    });
  });

  const cancelOrder = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { orderId } = req.params;

     if (typeof orderId !== "string" || !orderId) {
      throw new BadRequestError("Order ID is required");
    }

    const order = await orderService.cancelOrder(
      userId,
      orderId,
    );

    res.status(200).json({
      success: true,
      data: order,
    });
  });

  return {
    checkout,
    buyNow,
    getMyOrders,
    getMyOrderById,
    cancelOrder,
  };
};