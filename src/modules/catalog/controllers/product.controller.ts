import type { RequestHandler } from "express";
import type { ProductService } from "../services/product.service.js";
import type { ProductMapper } from "../mappers/product.mapper.js";
import type { CreateProductDto, UpdateProductDto } from "../dto/product.dto.js";
import type { ProductQueryDto } from "../dto/product-query.dto.js";
import { productQuerySchema } from "../validators/product-query.validator.js";
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

  // Fetch products using query filters, search, sorting, and pagination.
  const getAll = asyncHandler(async (req, res) => {
    const result = productQuerySchema.safeParse(req.query);

    if (!result.success) {
      throw new BadRequestError(result.error.message);
    }

    const query: ProductQueryDto = result.data;

    const { products, total } = await productService.getProducts(query);

    const totalPages = Math.ceil(total / query.limit);

    res.status(200).json({
      success: true,
      data: await productMapper.toResponseList(products),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
      },
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
    update,
    archive,
  };
};
