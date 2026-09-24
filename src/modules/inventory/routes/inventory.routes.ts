import { Router } from "express";
import type { RequestHandler } from "express";
import type { InventoryController } from "../controllers/inventory.controller.js";
import { initializeInventorySchema, addStockSchema, removeStockSchema } from "../validators/inventory.validator.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";


type InventoryRoutesDependencies = {
  inventoryController: InventoryController;
  authenticate: RequestHandler;
  authorizePermission: (permission: string) => RequestHandler;
};

export const createInventoryRoutes = ({
  inventoryController,
  authenticate,
  authorizePermission,
}: InventoryRoutesDependencies) => {
    
  const router = Router();

  router.post(
    "/",
    authenticate,
    authorizePermission("inventory.create"),
    validate(initializeInventorySchema),
    inventoryController.initialize,
  );

  router.get(
    "/product/:productId",
    authenticate,
    authorizePermission("inventory.read"),
    inventoryController.getByProductId,
  );

  router.get(
    "/:id",
    authenticate,
    authorizePermission("inventory.read"),
    inventoryController.getById,
  );

  router.post(
    "/product/:productId/stock-in",
    authenticate,
    authorizePermission("inventory.stock_in"),
    validate(addStockSchema),
    inventoryController.addStock,
  );

  router.post(
    "/product/:productId/stock-out",
    authenticate,
    authorizePermission("inventory.stock_out"),
    validate(removeStockSchema),
    inventoryController.removeStock,
  );

  router.get(
    "/:id/movements",
    authenticate,
    authorizePermission("inventory.read"),
    inventoryController.getMovements,
  );

  return router;
};

export type InventoryRoutes = ReturnType<typeof createInventoryRoutes>;