import type { RequestHandler } from "express";
import { NotFoundError } from "../shared/errors/NotFoundError.js";


export const notFound: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError("Route not found"));
};