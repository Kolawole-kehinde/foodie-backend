import type { RequestHandler } from "express";
import type { CategoryService } from "../services/category.service.js";
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
} from "../dto/category.dto.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";

type CreateCategoryControllerDependencies = {
  categoryService: CategoryService;
};

type CategoryController = {
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
    const id = req.params.id;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const category = await categoryService.getById(id);

    res.status(200).json({
      success: true,
      data: category,
    });
  });

  const getBySlug = asyncHandler(async (req, res) => {
    const slug = req.params.slug;

    if (!slug || Array.isArray(slug)) {
      res.status(400).json({
        success: false,
        message: "Invalid category slug",
      });
      return;
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
    const id = req.params.id;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const dto: UpdateCategoryDto = req.body;

    const category = await categoryService.update(id, dto);

    res.status(200).json({
      success: true,
      data: category,
    });
  });

  const deactivate = asyncHandler(async (req, res) => {
    const id = req.params.id;

    if (!id || Array.isArray(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
      return;
    }

    const category = await categoryService.deactivate(id);

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