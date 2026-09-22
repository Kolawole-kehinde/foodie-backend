import type { RequestHandler } from "express";
import type { ProductService } from "../services/product.service.js";
import type {
  CreateProductDto,
  UpdateProductDto,
} from "../dto/product.dto.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";

type CreateProductControllerDependencies = {
  productService: ProductService;
};

export type ProductController = {
  create: RequestHandler;
  getById: RequestHandler;
  getBySlug: RequestHandler;
  getAll: RequestHandler;
  getByCategory: RequestHandler;
  update: RequestHandler;
  archive: RequestHandler;
};

export const createProductController = ({
  productService,
}: CreateProductControllerDependencies): ProductController => {
  const create = asyncHandler(async (req, res) => {
    const dto: CreateProductDto = req.body;

    const product = await productService.create(dto);

    res.status(201).json({
      success: true,
      data: product,
    });
  });

  const getById = asyncHandler(async (req, res) => {
    const productId = req.params.productId;

    if (typeof productId !== "string" || !productId) {
      throw new BadRequestError("Product ID is required");
    }

    const product = await productService.getProductById(productId);

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  const getBySlug = asyncHandler(async (req, res) => {
    const slug = req.params.slug;

    if (typeof slug !== "string" || !slug) {
      throw new BadRequestError("Product slug is required");
    }

    const product = await productService.getProductBySlug(slug);

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  const getAll = asyncHandler(async (_req, res) => {
    const products = await productService.getAllProducts();

    res.status(200).json({
      success: true,
      data: products,
    });
  });

  const getByCategory = asyncHandler(async (req, res) => {
    const categoryId = req.params.categoryId;

    if (typeof categoryId !== "string" || !categoryId) {
      throw new BadRequestError("Category ID is required");
    }

    const products =
      await productService.getProductsByCategory(categoryId);

    res.status(200).json({
      success: true,
      data: products,
    });
  });

  const update = asyncHandler(async (req, res) => {
    const productId = req.params.productId;

    if (typeof productId !== "string" || !productId) {
      throw new BadRequestError("Product ID is required");
    }

    const dto: UpdateProductDto = req.body;

    const product = await productService.update(productId, dto);

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  const archive = asyncHandler(async (req, res) => {
    const productId = req.params.productId;

    if (typeof productId !== "string" || !productId) {
      throw new BadRequestError("Product ID is required");
    }

    const product = await productService.archive(productId);

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  return {
    create,
    getById,
    getBySlug,
    getAll,
    getByCategory,
    update,
    archive,
  };
};