import type z from "zod";
import type {
  buyNowSchema,
  cancelOrderParamsSchema,
  orderIdParamsSchema,
} from "../validators/validator.order.js";

export type BuyNowDto = z.infer<typeof buyNowSchema>;
export type OrderIdParamsDto = z.infer<typeof orderIdParamsSchema>;
export type CancelOrderParamsDto = z.infer<typeof cancelOrderParamsSchema>;
