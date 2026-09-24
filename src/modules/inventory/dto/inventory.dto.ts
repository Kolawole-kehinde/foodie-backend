import type z from "zod";
import type {
  initializeInventorySchema,
  addStockSchema,
  removeStockSchema,
} from "../validators/inventory.validator.js";



export type InitializeInventoryDto = z.infer<typeof initializeInventorySchema>;

export type AddStockDto = z.infer<typeof addStockSchema>;

export type RemoveStockDto = z.infer<typeof removeStockSchema>;
