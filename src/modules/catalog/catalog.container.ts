import type { DatabaseClient } from "../../database/prisma/types.js";
import type { RequestHandler } from "express";
import type { MediaUploadRepository } from "../media/repositories/media-upload.repository.js";
import type { S3Service } from "../../infrastructure/s3/s3.service.js";
import { createCategoryRepository } from "./repositories/category.repository.js";
import { createProductRepository } from "./repositories/product.repository.js";
import { createCategoryService } from "./services/category.service.js";
import { createProductService } from "./services/product.service.js";
import { createCategoryController } from "./controllers/category.controller.js";
import { createProductController } from "./controllers/product.controller.js";
import { createProductMapper } from "./mappers/product.mapper.js";
import { createCatalogRoutes } from "./routes/catalog.routes.js";

type CatalogDependencies = {
  db: DatabaseClient;
  mediaUploadRepository: MediaUploadRepository;
  s3Service: S3Service;
  authenticate: RequestHandler;
  authorizePermission: (permission: string) => RequestHandler;
};

export const createCatalogDependencies = ({
  db,
  mediaUploadRepository,
  s3Service,
  authenticate,
  authorizePermission,
}: CatalogDependencies) => {
  // Repositories
  const categoryRepository = createCategoryRepository(db);
  const productRepository = createProductRepository(db);

  // Services
  const categoryService = createCategoryService({
    categoryRepository,
  });

  const productService = createProductService({
    productRepository,
    categoryRepository,
    mediaUploadRepository,
  });

  // Mappers
  const productMapper = createProductMapper({
    s3Service,
  });

  // Controllers
  const categoryController = createCategoryController({
    categoryService,
  });

  const productController = createProductController({
    productService,
    productMapper,
  });

  // Routes
  const routes = createCatalogRoutes({
    categoryController,
    productController,
    authenticate,
    authorizePermission,
  });

  return {
    categoryRepository,
    productRepository,
    categoryService,
    productService,
    productMapper,
    categoryController,
    productController,
    routes,
  };
};

export type CatalogDependenciesContainer =
  ReturnType<typeof createCatalogDependencies>;