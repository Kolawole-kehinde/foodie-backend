import { z } from "zod";
export const permissionIdSchema = z.object({
  permissionId: z.string().min(1, "Permission ID is required"),
});
