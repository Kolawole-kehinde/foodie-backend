import { Router, type RequestHandler } from "express";

import type { OrderController } from "../controllers/controller.order.js";

import { validate } from "../../../shared/middleware/validate.middleware.js";

import {
  buyNowSchema,
  checkoutSchema,
  orderIdParamsSchema,
} from "../validators/validator.order.js";

type CreateOrderRouteDependencies = {
  orderController: OrderController;
  authenticate: RequestHandler;
  authorizePermission: (
    permission: string,
  ) => RequestHandler;
};

export const createOrderRoutes = ({
  orderController,
  authenticate,
  authorizePermission,
}: CreateOrderRouteDependencies): Router => {
  const router = Router();

  // Customer routes
  router.post(
    "/",
    authenticate,
    validate(checkoutSchema),
    orderController.checkout,
  );

  router.post(
    "/buy-now",
    authenticate,
    validate(buyNowSchema),
    orderController.buyNow,
  );

  router.get(
    "/",
    authenticate,
    orderController.getMyOrders,
  );

  router.get(
    "/:orderId",
    authenticate,
    validate(orderIdParamsSchema, "params"),
    orderController.getMyOrderById,
  );

  router.post(
    "/:orderId/cancel",
    authenticate,
    validate(orderIdParamsSchema, "params"),
    orderController.cancelOrder,
  );

  // Staff / admin status management
  router.post(
    "/:orderId/confirm",
    authenticate,
    authorizePermission("orders.confirm"),
    validate(orderIdParamsSchema, "params"),
    orderController.confirmOrder,
  );

  router.post(
    "/:orderId/process",
    authenticate,
    authorizePermission("orders.process"),
    validate(orderIdParamsSchema, "params"),
    orderController.processOrder,
  );

  router.post(
    "/:orderId/ship",
    authenticate,
    authorizePermission("orders.ship"),
    validate(orderIdParamsSchema, "params"),
    orderController.shipOrder,
  );

  router.post(
    "/:orderId/deliver",
    authenticate,
    authorizePermission("orders.deliver"),
    validate(orderIdParamsSchema, "params"),
    orderController.deliverOrder,
  );

  return router;
};

export type OrderRoute = ReturnType<typeof createOrderRoutes>;