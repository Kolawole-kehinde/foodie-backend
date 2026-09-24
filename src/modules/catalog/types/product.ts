import type { ProductStatus } from "@prisma/client";
import type { MediaUploadRepository } from "../../media/repositories/media-upload.repository.js";
import type { CategoryRepository } from "../repositories/category.repository.js";
import type { ProductRepository } from "../repositories/product.repository.js";

export type ProductServiceDependencies = {
  productRepository: ProductRepository;
  categoryRepository: CategoryRepository;
  mediaUploadRepository: MediaUploadRepository;
};

export type CreateProductData = {
  userId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  mediaUploadId?: string;
  status?: ProductStatus;
};

export type UpdateProductData = {
  userId: string;
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  mediaUploadId?: string | null;
  status?: ProductStatus;
};

export type GetProductsData = {
  category?: string;
  search?: string;
  status?: ProductStatus;
  page: number;
  limit: number;
  sortBy: "createdAt" | "price" | "name";
  sortOrder: "asc" | "desc";
};
