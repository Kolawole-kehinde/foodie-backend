import type { Product } from "@prisma/client";

import type { S3Service } from "../../../infrastructure/s3/s3.service.js";

type ProductMapperDependencies = {
  s3Service: S3Service;
};

export const createProductMapper = ({
  s3Service,
}: ProductMapperDependencies) => {
  const toResponse = async (product: Product) => {
    const imageUrl = product.imageKey
      ? await s3Service.createDownloadUrl(product.imageKey)
      : null;

    return {
      id: product.id,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      imageUrl,
      status: product.status,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  };

  const toResponseList = async (products: Product[]) => {
    return Promise.all(products.map(toResponse));
  };

  return {
    toResponse,
    toResponseList,
  };
};

export type ProductMapper = ReturnType<typeof createProductMapper>;