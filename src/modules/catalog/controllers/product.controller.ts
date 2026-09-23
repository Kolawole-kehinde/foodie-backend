import type { RequestHandler } from "express";

import type { ProductService } from "../services/product.service.js";
import type { ProductMapper } from "../mappers/product.mapper.js";
import type {
  CreateProductDto,
  UpdateProductDto,
} from "../dto/product.dto.js";

import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";

type CreateProductControllerDependencies = {
  productService: ProductService;
  productMapper: ProductMapper;
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
  productMapper,
}: CreateProductControllerDependencies): ProductController => {
  const create = asyncHandler(async (req, res) => {
    const dto: CreateProductDto = req.body;

    const product = await productService.create({
      ...dto,
      userId: req.user.id,
    });

    res.status(201).json({
      success: true,
      data: await productMapper.toResponse(product),
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
      data: await productMapper.toResponse(product),
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
      data: await productMapper.toResponse(product),
    });
  });

  const getAll = asyncHandler(async (_req, res) => {
    const products = await productService.getAllProducts();

    res.status(200).json({
      success: true,
      data: await productMapper.toResponseList(products),
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
      data: await productMapper.toResponseList(products),
    });
  });

  const update = asyncHandler(async (req, res) => {
    const productId = req.params.productId;

    if (typeof productId !== "string" || !productId) {
      throw new BadRequestError("Product ID is required");
    }

    const dto: UpdateProductDto = req.body;

    const product = await productService.update(productId, {
      ...dto,
      userId: req.user.id,
    });

    res.status(200).json({
      success: true,
      data: await productMapper.toResponse(product),
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
      data: await productMapper.toResponse(product),
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