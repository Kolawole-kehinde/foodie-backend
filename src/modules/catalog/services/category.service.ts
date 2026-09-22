import { ConflictError, NotFoundError } from "../../../shared/errors/index.js";
import type { CategoryRepository } from "../repositories/category.repository.js";

type CategoryServiceDependencies = {
  categoryRepository: CategoryRepository;
};

type CreateCategoryData = {
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
};

type UpdateCategoryData = {
  name?: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
};

export const createCategoryService = ({ categoryRepository}: CategoryServiceDependencies) => {
    
  const create = async (data: CreateCategoryData) => {
    const existingCategory = await categoryRepository.getCategoryBySlug(
      data.slug,
    );

    if (existingCategory) {
      throw new ConflictError("Category with this slug already exists");
    }

    return categoryRepository.create(data);
  };
  

  const getById = async (id: string) => {
    const category = await categoryRepository.getCategoryById(id);

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    return category;
  };

  const getBySlug = async (slug: string) => {
    const category = await categoryRepository.getCategoryBySlug(slug);

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    return category;
  };

  const getAll = async () => {
    return categoryRepository.getAllCategories();
  };

  const update = async ( id: string, data: UpdateCategoryData,) => {

    await getById(id);

    if (data.slug) {
      const existingCategory = await categoryRepository.getCategoryBySlug(
        data.slug,
      );

      if (existingCategory && existingCategory.id !== id) {
        throw new ConflictError("Category with this slug already exists");
      }
    }

    return categoryRepository.updateCategory(id, data);
  };

  const deactivate = async (id: string) => {
    await getById(id);

    return categoryRepository.deactivate(id);
  };

  return {
    create,
    getById,
    getBySlug,
    getAll,
    update,
    deactivate,
  };
};

export type CategoryService = ReturnType<typeof createCategoryService>;
