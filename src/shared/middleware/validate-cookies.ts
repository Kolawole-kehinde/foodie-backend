import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

export const validateCookies = (schema: z.ZodType) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.cookies);

    if (!result.success) {
      return next(result.error);
    }

    next();
  };