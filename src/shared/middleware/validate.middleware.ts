import { z } from "zod";
import type { Request, Response, NextFunction } from "express";

type ValidationSchemas = {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
};

export const validate =
  ({ body, params, query }: ValidationSchemas) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (body) {
      const result = body.safeParse(req.body);

      if (!result.success) {
        return next(result.error);
      }

      req.body = result.data;
    }

    if (params) {
      const result = params.safeParse(req.params);

      if (!result.success) {
        return next(result.error);
      }

      req.params = result.data;
    }

    if (query) {
      const result = query.safeParse(req.query);

      if (!result.success) {
        return next(result.error);
      }

      req.query = result.data;
    }

    next();
  };