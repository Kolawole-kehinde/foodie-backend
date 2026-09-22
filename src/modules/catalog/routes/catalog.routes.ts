import { Router } from "express";
import type { RequestHandler } from "express";

import type { CategoryController } from "../controllers/category.controller.js";
import type { ProductController } from "../controllers/product.controller.js";

type CatalogRouteDependencies = {
  categoryController: CategoryController;
  productController: ProductController;
  authenticate: RequestHandler;
  authorizePermission: (
    permission: string,
  ) => RequestHandler;
};

export const createCatalogRoutes = ({
  categoryController,
  productController,
  authenticate,
  authorizePermission,
}: CatalogRouteDependencies) => {
  const router = Router();


  // Read categories
  router.get(
    "/categories",
    authenticate,
    categoryController.getAll,
  );

  router.get(
    "/categories/:id",
    authenticate,
    categoryController.getById,
  );

  router.get(
    "/categories/slug/:slug",
    authenticate,
    categoryController.getBySlug,
  );

  // Manage categories
  router.post(
    "/categories",
    authenticate,
    authorizePermission("categories.create"),
    categoryController.create,
  );

  router.patch(
    "/categories/:id",
    authenticate,
    authorizePermission("categories.update"),
    categoryController.update,
  );

  router.delete(
    "/categories/:id",
    authenticate,
    authorizePermission("categories.delete"),
    categoryController.deactivate,
  );

  /*
   * Products
   */

  // Read products
  router.get(
    "/products",
    authenticate,
    productController.getAll,
  );

  router.get(
    "/products/:id",
    authenticate,
    productController.getById,
  );

  router.get(
    "/products/slug/:slug",
    authenticate,
    productController.getBySlug,
  );

  router.get(
    "/products/category/:categoryId",
    authenticate,
    productController.getByCategory,
  );

  // Manage products
  router.post(
    "/products",
    authenticate,
    authorizePermission("products.create"),
    productController.create,
  );

  router.patch(
    "/products/:id",
    authenticate,
    authorizePermission("products.update"),
    productController.update,
  );

  router.delete(
    "/products/:id",
    authenticate,
    authorizePermission("products.delete"),
    productController.archive,
  );

  return router;
};