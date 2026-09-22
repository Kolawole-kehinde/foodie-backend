import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createCategoryRepository = (db: DatabaseClient) => {
    
  const create = async (data: Prisma.CategoryCreateInput) => {
    return db.category.create({
      data,
    });
  };

  const getCategoryById = async (id: string) => {
    return db.category.findUnique({
      where: {
        id,
      },
    });
  };

  const getCategoryBySlug = async (slug: string) => {
    return db.category.findUnique({
      where: {
        slug,
      },
    });
  };

  const getAllCategories = async () => {
    return db.category.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  const updateCategory = async (
    id: string,
    data: Prisma.CategoryUpdateInput,
  ) => {
    return db.category.update({
      where: {
        id,
      },
      data,
    });
  };

  const deactivate = async (id: string) => {
    return db.category.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  };

  return {
    create,
    getCategoryById,
    getCategoryBySlug,
    getAllCategories,
    updateCategory,
    deactivate,
  };
};

export type CategoryRepository = ReturnType<typeof createCategoryRepository>;