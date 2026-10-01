import { z } from "zod";

import type {
  buyNowSchema,
  cancelOrderParamsSchema,
  checkoutSchema,
  orderIdParamsSchema,
  shippingAddressSchema,
} from "../validators/validator.order.js";

export type ShippingAddressDto = z.infer<typeof shippingAddressSchema>;

export type CheckoutDto = z.infer<typeof checkoutSchema>;

export type BuyNowDto = z.infer<typeof buyNowSchema>;

export type OrderIdParamsDto = z.infer<typeof orderIdParamsSchema>;

export type CancelOrderParamsDto = z.infer<typeof cancelOrderParamsSchema>;