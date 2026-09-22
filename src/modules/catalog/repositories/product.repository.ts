import { ProductStatus, type Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createProductRepository = (db: DatabaseClient) => {
  const create = async (data: Prisma.ProductCreateInput) => {
    return db.product.create({
      data,
    });
  };

  const getProductById = async (id: string) => {
    return db.product.findUnique({
      where: {
        id,
      },
    });
  };

  const getProductBySlug = async (slug: string) => {
    return db.product.findUnique({
      where: {
        slug,
      },
    });
  };

  const getAllProducts = async () => {
    return db.product.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  const getProductsByCategory = async (categoryId: string) => {
    return db.product.findMany({
      where: {
        categoryId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  const updateProduct = async (id: string, data: Prisma.ProductUpdateInput) => {
    return db.product.update({
      where: {
        id,
      },
      data,
    });
  };

  const archiveProduct = async (id: string) => {
    return db.product.update({
      where: {
        id,
      },
      data: {
        status: ProductStatus.ARCHIVED,
      },
    });
  };

  return {
    create,
    getProductById,
    getProductBySlug,
    getAllProducts,
    getProductsByCategory,
    updateProduct,
    archiveProduct,
  };
};

export type ProductRepository = ReturnType<typeof createProductRepository>;
