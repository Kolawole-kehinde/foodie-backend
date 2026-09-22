import { ProductStatus } from "@prisma/client";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

import type { CategoryRepository } from "../repositories/category.repository.js";
import type { ProductRepository } from "../repositories/product.repository.js";
import type { MediaUploadRepository } from "../../media/repositories/media-upload.repository.js";

type ProductServiceDependencies = {
  productRepository: ProductRepository;
  categoryRepository: CategoryRepository;
  mediaUploadRepository: MediaUploadRepository;
};

type CreateProductData = {
  userId: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  mediaUploadId?: string;
  status?: ProductStatus;
};

type UpdateProductData = {
  userId: string;
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  mediaUploadId?: string | null;
  status?: ProductStatus;
};

export const createProductService = ({
  productRepository,
  categoryRepository,
  mediaUploadRepository,
}: ProductServiceDependencies) => {
  const create = async (data: CreateProductData) => {
    const category = await categoryRepository.getCategoryById(data.categoryId);

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    if (!category.isActive) {
      throw new ConflictError("Category is inactive");
    }

    const existingProduct = await productRepository.getProductBySlug(data.slug);

    if (existingProduct) {
      throw new ConflictError("Product with this slug already exists");
    }

    let imageKey: string | undefined;

    if (data.mediaUploadId) {
      const mediaUpload = await mediaUploadRepository.findReadyProductUpload(
        data.mediaUploadId,
        data.userId,
      );

      if (!mediaUpload) {
        throw new NotFoundError("Product image upload not found");
      }

      imageKey = mediaUpload.objectKey;
    }

    return productRepository.create({
      category: {
        connect: {
          id: data.categoryId,
        },
      },
      name: data.name,
      slug: data.slug,
      description: data.description,
      price: data.price,
      imageKey,
      status: data.status ?? ProductStatus.DRAFT,
    });
  };

  const getProductById = async (id: string) => {
    const product = await productRepository.getProductById(id);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return product;
  };

  const getProductBySlug = async (slug: string) => {
    const product = await productRepository.getProductBySlug(slug);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    return product;
  };

  const getAllProducts = async () => {
    return productRepository.getAllProducts();
  };

  const getProductsByCategory = async (categoryId: string) => {
    const category = await categoryRepository.getCategoryById(categoryId);

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    return productRepository.getProductsByCategory(categoryId);
  };

  const update = async (id: string, data: UpdateProductData) => {
    await getProductById(id);

    if (data.categoryId) {
      const category = await categoryRepository.getCategoryById(
        data.categoryId,
      );

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      if (!category.isActive) {
        throw new ConflictError("Category is inactive");
      }
    }

    if (data.slug) {
      const existingProduct = await productRepository.getProductBySlug(
        data.slug,
      );

      if (existingProduct && existingProduct.id !== id) {
        throw new ConflictError("Product with this slug already exists");
      }
    }

    let imageKey: string | null | undefined;

    if (data.mediaUploadId !== undefined) {
      if (data.mediaUploadId === null) {
        imageKey = null;
      } else {
        const mediaUpload =
          await mediaUploadRepository.findReadyProductUpload(
            data.mediaUploadId,
            data.userId,
          );

        if (!mediaUpload) {
          throw new NotFoundError("Product image upload not found");
        }

        imageKey = mediaUpload.objectKey;
      }
    }

    return productRepository.updateProduct(id, {
      ...(data.categoryId && {
        category: {
          connect: {
            id: data.categoryId,
          },
        },
      }),

      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.slug !== undefined && {
        slug: data.slug,
      }),

      ...(data.description !== undefined && {
        description: data.description,
      }),

      ...(data.price !== undefined && {
        price: data.price,
      }),

      ...(data.status !== undefined && {
        status: data.status,
      }),

      ...(data.mediaUploadId !== undefined && {
        imageKey,
      }),
    });
  };

  const archive = async (id: string) => {
    await getProductById(id);

    return productRepository.archiveProduct(id);
  };

  return {
    create,
    getProductById,
    getProductBySlug,
    getAllProducts,
    getProductsByCategory,
    update,
    archive,
  };
};

export type ProductService = ReturnType<typeof createProductService>;