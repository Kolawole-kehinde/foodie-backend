import z from "zod";
import type { addCartItemSchema, updateCartItemSchema } from "../validators/cart.validator.js";


export type addCartDto = z.infer<typeof addCartItemSchema> 
export type updateCartItem = z.infer<typeof updateCartItemSchema>