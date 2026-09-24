import { ProductStatus, type Prisma } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

type GetProductsParams = {
  categoryId?: string;
  search?: string;
  status?: ProductStatus;
  page: number;
  limit: number;
  sortBy: "createdAt" | "price" | "name";
  sortOrder: "asc" | "desc";
};

export const createProductRepository = (db: DatabaseClient) => {

  const create = async (data: Prisma.ProductCreateInput) => {
    return db.product.create({
       data 
      });
  };

  const getProductById = async (id: string) => {
    return db.product.findUnique({
       where: { 
        id 
      } 
    });
  };

  const getProductBySlug = async (slug: string) => {
    return db.product.findUnique({
       where: { 
        slug 
      } });
  };

  // Fetch products with filtering, searching, sorting, and pagination.
  const getProducts = async ({ categoryId, search, status, page,  limit, sortBy, sortOrder}: GetProductsParams) => {
    const where: Prisma.ProductWhereInput = {
      ...(categoryId && { categoryId }),
      ...(status && { status }),
      ...(search && {
        OR: [
          {
            name: {
              contains: search,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: search,
              mode: "insensitive",
            },
          },
        ],
      }),
    };

    const skip = (page - 1) * limit;

    // Run the product query and total count together.
    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),

      db.product.count({ where }),
    ]);

    return {
      products,
      total,
    };
  };

  const updateProduct = async (id: string, data: Prisma.ProductUpdateInput) => {
    return db.product.update({
      where: { id },
      data,
    });
  };

  const archiveProduct = async (id: string) => {
    return db.product.update({
      where: { id },
      data: { 
        status: ProductStatus.ARCHIVED 
      },
    });
  };

  return {
    create,
    getProductById,
    getProductBySlug,
    getProducts,
    updateProduct,
    archiveProduct,
  };
};

export type ProductRepository = ReturnType<typeof createProductRepository>;
