import { z } from "zod";

export const shippingAddressSchema = z.object({
  recipientName: z
    .string()
    .trim()
    .min(1, "Recipient name is required")
    .max(100, "Recipient name is too long"),

  phone: z
    .string()
    .trim()
    .min(7, "Phone number is required")
    .max(20, "Phone number is too long"),

  addressLine1: z
    .string()
    .trim()
    .min(1, "Address is required")
    .max(255, "Address is too long"),

  addressLine2: z.string().trim().max(255, "Address is too long").optional(),

  city: z
    .string()
    .trim()
    .min(1, "City is required")
    .max(100, "City is too long"),

  state: z
    .string()
    .trim()
    .min(1, "State is required")
    .max(100, "State is too long"),

  postalCode: z.string().trim().max(20, "Postal code is too long").optional(),

  country: z
    .string()
    .trim()
    .min(1, "Country is required")
    .max(100, "Country is too long"),
});

export const checkoutSchema = z.object({
  shippingAddress: shippingAddressSchema,
});

export const buyNowSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),

  quantity: z
    .number()
    .int("Quantity must be a whole number")
    .positive("Quantity must be greater than zero"),

  shippingAddress: shippingAddressSchema,
});

export const orderIdParamsSchema = z.object({
  orderId: z.string().min(1, "Order ID is required"),
});

export const cancelOrderParamsSchema = orderIdParamsSchema;
