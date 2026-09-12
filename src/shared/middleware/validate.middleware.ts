import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

type ValidationTarget = "body" | "params" | "query";

export const validate =
  (
    schema: z.ZodType,
    target: ValidationTarget = "body",
  ) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const data = req[target];

    const result = schema.safeParse(data);

    if (!result.success) {
      return next(result.error);
    }

    if (target === "body") {
      req.body = result.data;
    }

    next();
  };