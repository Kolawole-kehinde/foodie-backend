import { Router, type RequestHandler } from "express";
import type { OrderController } from "../controllers/controller.order.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import {
  buyNowSchema,
  orderIdParamsSchema,
} from "../validators/validator.order.js";


type CreateOrderRouteDependencies = {
  orderController: OrderController;
  authenticate: RequestHandler;
  authorizePermission: (permission: string) => RequestHandler;
};

export const createOrderRoute = ({
  orderController,
  authenticate,
}: CreateOrderRouteDependencies) => {
  const router = Router();

  router.post(
    "/",
    authenticate,
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
    validate(orderIdParamsSchema),
    orderController.getMyOrderById,
  );

  router.post(
    "/:orderId/cancel",
    authenticate,
    validate(orderIdParamsSchema),
    orderController.cancelOrder,
  );

  return router;
};

export type OrderRoute = ReturnType<typeof createOrderRoute>;