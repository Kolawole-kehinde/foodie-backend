import type z from "zod";
import type { createCategorySchema } from "../validators/create-category.validator.js";

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;