import { z } from "../../../docs/zod-openapi.js";


export const permissionIdSchema = z.object({
  permissionId: z.string().min(1, "Permission ID is required"),
});
