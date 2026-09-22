import { ProductStatus } from "@prisma/client";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import type { CategoryRepository } from "../repositories/category.repository.js";
import type { ProductRepository } from "../repositories/product.repository.js";

type ProductServiceDependencies = {
  productRepository: ProductRepository;
  categoryRepository: CategoryRepository;
};

type CreateProductData = {
  categoryId: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  status?: ProductStatus;
};

type UpdateProductData = {
  categoryId?: string;
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  status?: ProductStatus;
};

export const createProductService = ({ productRepository, categoryRepository,}: ProductServiceDependencies) => {

  const create = async (data: CreateProductData) => {

    const category = await categoryRepository.getCategoryById(data.categoryId);

    if (!category) {
      throw new NotFoundError("Category not found");
    }

    // Do not allow products under inactive categories
    if (!category.isActive) {
      throw new ConflictError("Category is inactive");
    }

    // Prevent duplicate product slugs
    const existingProduct = await productRepository.getProductBySlug(data.slug);

    if (existingProduct) {
      throw new ConflictError("Product with this slug already exists");
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
    // Make sure the product exists
    await getProductById(id);

    // If changing the category, make sure the new category exists
    // and is active.
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

    // If changing the slug, make sure it isn't already used
    // by another product.
    if (data.slug) {
      const existingProduct = await productRepository.getProductBySlug(
        data.slug,
      );

      if (existingProduct && existingProduct.id !== id) {
        throw new ConflictError("Product with this slug already exists");
      }
    }

    return productRepository.updateProduct(id, data);
  };

  const archive = async (id: string) => {
    // Make sure the product exists before archiving
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
