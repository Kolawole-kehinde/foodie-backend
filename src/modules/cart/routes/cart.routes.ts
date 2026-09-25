import { Router } from "express";
import type { RequestHandler } from "express";
import type { CartController } from "../controllers/cart.controller.js";
import {
  addCartItemSchema,
  updateCartItemSchema,
} from "../validators/cart.validator.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";

type CartRoutesDependencies = {
  cartController: CartController;
  authenticate: RequestHandler;
};

export const createCartRoutes = ({
  cartController,
  authenticate,
}: CartRoutesDependencies) => {
  const router = Router();

  // Get authenticated user's cart
  router.get(
    "/",
    authenticate,
    cartController.getCart,
  );

  // Add product to cart
  router.post(
    "/items",
    authenticate,
    validate(addCartItemSchema),
    cartController.addItem,
  );

  // Update cart item quantity
  router.patch(
    "/items/:itemId",
    authenticate,
    validate(updateCartItemSchema),
    cartController.updateItem,
  );

  // Remove one item from cart
  router.delete(
    "/items/:itemId",
    authenticate,
    cartController.removeItem,
  );

  // Clear all items from cart
  router.delete(
    "/",
    authenticate,
    cartController.clearCart,
  );

  return router;
};

export type CartRoutes = ReturnType<typeof createCartRoutes>;