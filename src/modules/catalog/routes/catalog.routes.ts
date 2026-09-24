import { Router } from "express";
import type { RequestHandler } from "express";
import type { CategoryController } from "../controllers/category.controller.js";
import type { ProductController } from "../controllers/product.controller.js";

type CatalogRouteDependencies = {
  categoryController: CategoryController;
  productController: ProductController;
  authenticate: RequestHandler;
  authorizePermission: ( permission: string) => RequestHandler;
};

export const createCatalogRoutes = ({
  categoryController,
  productController,
  authenticate,
  authorizePermission,
}: CatalogRouteDependencies) => {
  
  const router = Router();

  /*
   * Categories
   */

  // Read categories
  router.get(
    "/categories",
    authenticate,
    categoryController.getAll,
  );

  router.get(
    "/categories/slug/:slug",
    authenticate,
    categoryController.getBySlug,
  );

  router.get(
    "/categories/:id",
    authenticate,
    categoryController.getById,
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
  // Filtering, search, sorting, and pagination are handled
  // through query parameters.
  router.get(
    "/products",
    authenticate,
    productController.getAll,
  );

  // More specific product routes must come before /:productId.
  router.get(
    "/products/slug/:slug",
    authenticate,
    productController.getBySlug,
  );

  router.get(
    "/products/:productId",
    authenticate,
    productController.getById,
  );

  // Manage products
  router.post(
    "/products",
    authenticate,
    authorizePermission("products.create"),
    productController.create,
  );

  router.patch(
    "/products/:productId",
    authenticate,
    authorizePermission("products.update"),
    productController.update,
  );

  router.delete(
    "/products/:productId",
    authenticate,
    authorizePermission("products.delete"),
    productController.archive,
  );

  return router;
};