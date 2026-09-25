import type { DatabaseClient } from "../../database/prisma/types.js";
import type { RequestHandler } from "express";
import { createCartRepository } from "./repositories/cart.repository.js";
import { createCartService } from "./services/cart.service.js";
import { createCartController } from "./controllers/cart.controller.js";
import type { ProductRepository } from "../catalog/repositories/product.repository.js";
import { createCartRoutes } from "./routes/cart.routes.js";

type CartDependencies = {
  db: DatabaseClient;
  productRepository: ProductRepository;
  authenticate: RequestHandler;
};

export const createCartDependencies = ({
  db,
  productRepository,
  authenticate,
}: CartDependencies) => {
  // Repository
  const cartRepository = createCartRepository(db);

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

export type CartDependenciesContainer =
  ReturnType<typeof createCartDependencies>;