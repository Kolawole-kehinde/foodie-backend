import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createCartRepository = (db: DatabaseClient) => {
  const create = async (data: Prisma.CartCreateInput) => {
    return db.cart.create({
      data,
    });
  };

  const getByUserId = async (userId: string) => {
    return db.cart.findUnique({
      where: {
        userId,
      },
    });
  };

  const getById = async (id: string) => {
    return db.cart.findUnique({
      where: {
        id,
      },
    });
  };

  const getByUserIdWithItems = async (userId: string) => {
    return db.cart.findUnique({
      where: {
        userId,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });
  };

  const getItem = async (cartId: string, productId: string) => {
    return db.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId,
          productId,
        },
      },
    });
  };

  const getItemById = async (itemId: string) => {
    return db.cartItem.findUnique({
      where: {
        id: itemId,
      },
    });
  };

  const createItem = async (data: Prisma.CartItemCreateInput) => {
    return db.cartItem.create({
      data,
    });
  };

  const updateItemQuantity = async (
    id: string,
    data: Prisma.CartItemUpdateInput,
  ) => {
    return db.cartItem.update({
      where: {
        id,
      },
      data,
    });
  };

  const deleteItem = async (id: string) => {
    return db.cartItem.delete({
      where: {
        id,
      },
    });
  };
  const clearItems = async (cartId: string) => {
    return db.cartItem.deleteMany({
      where: {
        cartId,
      },
    });
  };

  return {
    create,
    getByUserId,
    getById,
    getByUserIdWithItems,
    getItem,
    getItemById,
    createItem,
    updateItemQuantity,
    deleteItem,
    clearItems,
  };
};

export type CartRepository = ReturnType<typeof createCartRepository>;
