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
  const validateCategory = async (categoryId: string) => {
    const category = await categoryRepository.getCategoryById(categoryId);

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    if (!category.isActive) {
      throw new ConflictError("Category is inactive");
    }

    return category;
  };

  const validateProductSlug = async (
    slug: string,
    productId?: string,
  ) => {
    const existingProduct =
      await productRepository.getProductBySlug(slug);

    if (existingProduct && existingProduct.id !== productId) {
      throw new ConflictError("Product with this slug already exists");
    }
  };

  const resolveImageKey = async (
    mediaUploadId: string,
    userId: string,
  ) => {
    const mediaUpload =
      await mediaUploadRepository.findReadyProductUpload(
        mediaUploadId,
        userId,
      );

    if (!mediaUpload) {
      throw new NotFoundError("Product image upload not found");
    }

    return mediaUpload.objectKey;
  };

  const create = async (data: CreateProductData) => {
    await validateCategory(data.categoryId);

    await validateProductSlug(data.slug);

    let imageKey: string | undefined;

    if (data.mediaUploadId) {
      imageKey = await resolveImageKey(
        data.mediaUploadId,
        data.userId,
      );
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
    await validateCategory(categoryId);

    return productRepository.getProductsByCategory(categoryId);
  };

  const update = async (
    id: string,
    data: UpdateProductData,
  ) => {
    await getProductById(id);

    if (data.categoryId !== undefined) {
      await validateCategory(data.categoryId);
    }

    if (data.slug !== undefined) {
      await validateProductSlug(data.slug, id);
    }

    let imageKey: string | null | undefined;

    if (data.mediaUploadId !== undefined) {
      imageKey =
        data.mediaUploadId === null
          ? null
          : await resolveImageKey(
              data.mediaUploadId,
              data.userId,
            );
    }

    return productRepository.updateProduct(id, {
      ...(data.categoryId !== undefined && {
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