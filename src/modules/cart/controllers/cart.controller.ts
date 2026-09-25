import type { RequestHandler } from "express";

import type { CartService } from "../services/cart.service.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";

import type { AddCartItemDto, UpdateCartItemDto } from "../dto/cart.dto.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";

type CreateCartController = {
  cartService: CartService;
};


export type CartController = {
  getCart: RequestHandler;
  addItem: RequestHandler;
  updateItem: RequestHandler;
  removeItem: RequestHandler;
  clearCart: RequestHandler;
};

export const createCartController = ({ cartService }: CreateCartController): CartController => {
  // Gets the authenticated user's cart.
  const getCart = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const cart = await cartService.getCart(userId);

    res.status(200).json({
      success: true,
      data: cart,
    });
  });

  // Adds a product to the authenticated user's cart.
  const addItem = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const dto = req.body as AddCartItemDto;

    const cart = await cartService.addItem(userId, dto.productId, dto.quantity);

    res.status(200).json({
      success: true,
      data: cart,
    });
  });

  // Updates the quantity of an existing cart item.
  const updateItem = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const itemId = req.params.itemId;

    if(typeof itemId !== "string" || !itemId){
      throw new BadRequestError("item ID is required");
    }

    const dto = req.body as UpdateCartItemDto;

    const cart = await cartService.updateItem(userId, itemId, dto.quantity);

    res.status(200).json({
      success: true,
      data: cart,
    });
  });

  // Removes one item from the authenticated user's cart.
  const removeItem = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const itemId = req.params.itemId;

    if(typeof itemId !== "string" || !itemId){
       throw new BadRequestError("Item ID is required")
    }

    const cart = await cartService.removeItem(userId, itemId);

    res.status(200).json({
      success: true,
      data: cart,
    });
  });

  // Removes all items from the authenticated user's cart.
  const clearCart = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const cart = await cartService.clearCart(userId);

    res.status(200).json({
      success: true,
      data: cart,
    });
  });

  return {
    getCart,
    addItem,
    updateItem,
    removeItem,
    clearCart,
  };
};

