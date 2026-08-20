

import type { Request } from "express";

export const getClientIp = (req: Request): string => {
  return req.ip ?? "unknown";
};