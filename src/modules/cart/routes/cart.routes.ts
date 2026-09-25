import type { RequestHandler, Router } from "express";
import type { CartController } from "../controllers/cart.controller.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import { addCartItemSchema, updateCartItemSchema } from "../validators/cart.validator.js";


type CreateCartRoutesDependencies = {
  router: Router;
  cartController: CartController;
   authenticate: RequestHandler;
};

export const createCartRoutes = ({
  router,
  cartController, authenticate
}: CreateCartRoutesDependencies) => {
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