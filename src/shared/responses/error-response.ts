import type { Response } from "express";
import type { AppError } from "../errors/AppError.js";


export function sendError(
  res: Response,
  error: AppError,
  requestId?: string,
) {
  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    code: error.code,
    errors: error.details ?? null,
    requestId,
  });
}