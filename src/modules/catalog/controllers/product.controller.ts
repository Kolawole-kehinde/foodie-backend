import type { RequestHandler } from "express";
import type { ProductService } from "../services/product.service.js";
import type {
  CreateProductDto,
  UpdateProductDto,
} from "../dto/product.dto.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";

type CreateProductControllerDependencies = {
  productService: ProductService;
};

type ProductController = {
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
    const id = req.params.id;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const product = await productService.getProductById(id);

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  const getBySlug = asyncHandler(async (req, res) => {
    const slug = req.params.slug;

    if (!slug || Array.isArray(slug)) {
      res.status(400).json({
        success: false,
        message: "Invalid product slug",
      });
      return;
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

    if (!categoryId || Array.isArray(categoryId)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const products =  await productService.getProductsByCategory(categoryId);

    res.status(200).json({
      success: true,
      data: products,
    });
  });

  const update = asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const dto: UpdateProductDto = req.body;

    const product = await productService.update(id, dto);

    res.status(200).json({
      success: true,
      data: product,
    });
  });

  const archive = asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
      return;
    }

    const product = await productService.archive(id);

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