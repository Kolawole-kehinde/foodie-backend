import z from "zod";
import type { addCartItemSchema, updateCartItemSchema } from "../validators/cart.validator.js";


export type AddCartItemDto = z.infer<typeof addCartItemSchema> 
export type UpdateCartItemDto = z.infer<typeof updateCartItemSchema>