import type { DatabaseClient } from "../../database/prisma/types.js";
import { createCategoryRepository } from "./repositories/category.repository.js";
import { createProductRepository } from "./repositories/product.repository.js";
import { createCategoryService } from "./services/category.service.js";
import { createProductService } from "./services/product.service.js";
import { createCategoryController } from "./controllers/category.controller.js";
import { createProductController } from "./controllers/product.controller.js";
import { createCatalogRoutes } from "./routes/catalog.routes.js";

type CatalogContainerDependencies = {
  prisma: DatabaseClient;
};

export const createCatalogContainer = ({
  prisma,
}: CatalogContainerDependencies) => {

  // Repositories
  const categoryRepository = createCategoryRepository(prisma);
  const productRepository = createProductRepository(prisma);

  // Services
  const categoryService = createCategoryService({
    categoryRepository,
  });

  const productService = createProductService({
    productRepository,
    categoryRepository,
  });

  // Controllers
  const categoryController = createCategoryController({
    categoryService,
  });

  const productController = createProductController({
    productService,
  });

  // Routes
  const routes = createCatalogRoutes({
    categoryController,
    productController,
  });

  return {
    categoryRepository,
    productRepository,
    categoryService,
    productService,
    categoryController,
    productController,
    routes,
  };
};

export type CatalogContainer = ReturnType<typeof createCatalogContainer>;