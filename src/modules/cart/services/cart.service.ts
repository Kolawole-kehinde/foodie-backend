import type { CartRepository } from "../repositories/cart.repository.js";
import type { ProductRepository } from "../../catalog/repositories/product.repository.js";

import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";

type CartServiceDependencies = {
  cartRepository: CartRepository;
  productRepository: ProductRepository;
};

export const createCartService = ({
  cartRepository,
  productRepository,
}: CartServiceDependencies) => {
  // Gets the user's cart. If the user does not have one yet,
  // create it and return the cart with its items and products.
  const getCart = async (userId: string) => {
    const existingCart = await cartRepository.getByUserId(userId);

    if (!existingCart) {
      await cartRepository.create({
        user: {
          connect: {
            id: userId,
          },
        },
      });
    }

    const cart = await cartRepository.getByUserIdWithItems(userId);

    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    return cart;
  };

  // Adds a product to the user's cart.
  // If the product already exists, increase its quantity instead of creating a duplicate cart item.
  const addItem = async (
    userId: string,
    productId: string,
    quantity: number,
  ) => {
    if (quantity <= 0) {
      throw new ConflictError("Quantity must be greater than zero");
    }

    // Catalog remains the source of truth for product availability.
    const product = await productRepository.getProductById(productId);

    if (!product) {
      throw new NotFoundError("Product not found");
    }

    if (product.status !== "ACTIVE") {
      throw new ConflictError("Product is not available");
    }

    // Create the user's cart if it does not exist yet.
    const cart = await cartRepository.getByUserId(userId);

    const userCart =
      cart ??
      (await cartRepository.create({
        user: {
          connect: {
            id: userId,
          },
        },
      }));

    const existingItem = await cartRepository.getItem(userCart.id, productId);

    if (existingItem) {
      // The product is already in the cart, so increase its quantity.
      await cartRepository.updateItemQuantity(existingItem.id, {
        quantity: {
          increment: quantity,
        },
      });
    } else {
      // Product is not in the cart, so create a new cart item.
      await cartRepository.createItem({
        cart: {
          connect: {
            id: userCart.id,
          },
        },
        product: {
          connect: {
            id: productId,
          },
        },
        quantity,
      });
    }

    return cartRepository.getByUserIdWithItems(userId);
  };

  // Updates the quantity of an existing cart item.
  const updateItem = async (
    userId: string,
    itemId: string,
    quantity: number,
  ) => {
    if (quantity <= 0) {
      throw new ConflictError("Quantity must be greater than zero");
    }

    const cart = await cartRepository.getByUserId(userId);

    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    const item = await cartRepository.getItemById(itemId);

    if (!item) {
      throw new NotFoundError("Cart item not found");
    }

    // Prevent users from modifying an item belonging to another cart.
    if (item.cartId !== cart.id) {
      throw new NotFoundError("Cart item not found");
    }

    await cartRepository.updateItemQuantity(itemId, {
      quantity,
    });

    return cartRepository.getByUserIdWithItems(userId);
  };

  // Removes one item from the user's cart.
  const removeItem = async (userId: string, itemId: string) => {
    const cart = await cartRepository.getByUserId(userId);

    if (!cart) {
      throw new NotFoundError("Cart not found");
    }

    const item = await cartRepository.getItemById(itemId);

    if (!item) {
      throw new NotFoundError("Cart item not found");
    }

    // Ownership check: the item must belong to the user's cart.
    if (item.cartId !== cart.id) {
      throw new NotFoundError("Cart item not found");
    }

    await cartRepository.deleteItem(itemId);

    return cartRepository.getByUserIdWithItems(userId);
  };

  // Removes every item from the user's cart.
  const clearCart = async (userId: string) => {
    const cart = await cartRepository.getByUserId(userId);

    // A user without a cart is treated as having an empty cart.
    if (!cart) {
      return {
        id: null,
        userId,
        items: [],
      };
    }

    await cartRepository.clearItems(cart.id);

    return cartRepository.getByUserIdWithItems(userId);
  };

  return {
    getCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
  };
};

export type CartService = ReturnType<typeof createCartService>;
