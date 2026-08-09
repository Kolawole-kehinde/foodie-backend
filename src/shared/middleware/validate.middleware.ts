import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const validate =
  (schema: z.ZodType) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return next(result.error);
    }

    req.body = result.data;

    next();
  };