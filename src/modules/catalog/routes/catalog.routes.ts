import { Router } from "express";
import type { CategoryController } from "../controllers/category.controller.js";
import type { ProductController } from "../controllers/product.controller.js";

type CatalogRouteDependencies = {
  categoryController: CategoryController;
  productController: ProductController;
};

export const createCatalogRoutes = ({
  categoryController,
  productController,
}: CatalogRouteDependencies) => {
  const router = Router();

  // Categories
  router.post("/categories", categoryController.create);
  router.get("/categories", categoryController.getAll);
  router.get("/categories/:id", categoryController.getById);
  router.get("/categories/slug/:slug", categoryController.getBySlug);
  router.patch("/categories/:id", categoryController.update);
  router.delete("/categories/:id", categoryController.deactivate);

  // Products
  router.post("/products", productController.create);
  router.get("/products", productController.getAll);
  router.get("/products/:id", productController.getById);
  router.get("/products/slug/:slug", productController.getBySlug);
  router.get(
    "/products/category/:categoryId",
    productController.getByCategory,
  );
  router.patch("/products/:id", productController.update);
  router.delete("/products/:id", productController.archive);

  return router;
};