import type { RequestHandler, Router } from "express";
import { createCartRepository } from "./repositories/cart.repository.js";
import { createCartService } from "./services/cart.service.js";
import { createCartController } from "./controllers/cart.controller.js";
import { createCartRoutes } from "./routes/cart.routes.js";
import { createProductRepository } from "../catalog/repositories/product.repository.js";
import type { DatabaseClient } from "../../database/prisma/types.js";



type CreateCartContainerDependencies = {
  db: DatabaseClient;
  router: Router;
  authenticate: RequestHandler;
  
};

export const createCartContainer = ({
  router,
  authenticate, db
}: CreateCartContainerDependencies) => {
  // Repositories
  const cartRepository = createCartRepository(db);
  const productRepository = createProductRepository(db);

  // Service
  const cartService = createCartService({
    cartRepository,
    productRepository,
  });

  // Controller
  const cartController = createCartController({
    cartService,
  });

  // Routes
  const cartRoutes = createCartRoutes({
    router,
    cartController,
    authenticate,
  });

  return {
    cartRepository,
    cartService,
    cartController,
    cartRoutes,
  };
};

export type CartContainer = ReturnType<typeof createCartContainer>;