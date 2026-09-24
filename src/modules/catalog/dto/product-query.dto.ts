import type z from "zod";

import type { productQuerySchema } from "../validators/product-query.validator.js";

export type ProductQueryDto = z.infer<typeof productQuerySchema>;