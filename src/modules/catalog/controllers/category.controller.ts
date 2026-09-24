import type { RequestHandler } from "express";
import type { CategoryService } from "../services/category.service.js";
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
} from "../dto/category.dto.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";

type CreateCategoryControllerDependencies = {
  categoryService: CategoryService;
};

export type CategoryController = {
  create: RequestHandler;
  getById: RequestHandler;
  getBySlug: RequestHandler;
  getAll: RequestHandler;
  update: RequestHandler;
  deactivate: RequestHandler;
};

export const createCategoryController = ({
  categoryService,
}: CreateCategoryControllerDependencies): CategoryController => {
  const create = asyncHandler(async (req, res) => {
    const dto: CreateCategoryDto = req.body;

    const category = await categoryService.create(dto);

    res.status(201).json({
      success: true,
      data: category,
    });
  });

 const getById = asyncHandler(async (req, res) => {
  const categoryId = req.params.id;

  if (typeof categoryId !== "string" || !categoryId) {
    throw new BadRequestError("Category ID is required");
  }

  const category = await categoryService.getById(categoryId);

  res.status(200).json({
    success: true,
    data: category,
  });
});
  const getBySlug = asyncHandler(async (req, res) => {
    const slug = req.params.slug;

    if (typeof slug !== "string" || !slug) {
      throw new BadRequestError("Category slug is required");
    }

    const category = await categoryService.getBySlug(slug);

    res.status(200).json({
      success: true,
      data: category,
    });
  });

  const getAll = asyncHandler(async (_req, res) => {
    const categories = await categoryService.getAll();

    res.status(200).json({
      success: true,
      data: categories,
    });
  });

  const update = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;

    if (typeof categoryId !== "string" || !categoryId) {
      throw new BadRequestError("Category ID is required");
    }

    const data: UpdateCategoryDto = req.body;

    const category = await categoryService.update(categoryId, data);

    res.status(200).json({
      success: true,
      data: category,
    });
  });

  const deactivate = asyncHandler(async (req, res) => {
    const categoryId = req.params.id;

    if (typeof categoryId !== "string" || !categoryId) {
      throw new BadRequestError("Category ID is required");
    }

    const category = await categoryService.deactivate(categoryId);

    res.status(200).json({
      success: true,
      data: category,
    });
  });

  return {
    create,
    getById,
    getBySlug,
    getAll,
    update,
    deactivate,
  };
};

