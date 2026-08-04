import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

import { env } from "../config/env.js";
import { logger }from "../config/logger.js";
import { AppError } from "../shared/errors/AppError.js";
import { mapPrismaError } from "../shared/errors/prisma-error-mapper.js";
import { mapZodError } from "../shared/errors/zod-error-mapper.js";
import { sendError } from "../shared/responses/error-response.js";



export const errorHandler: ErrorRequestHandler = (
  error,
  req,
  res,
  _next,
) => {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof ZodError) {
    appError = mapZodError(error);
  } else {
    appError =
      mapPrismaError(error) ??
      new AppError("Internal Server Error", {
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
        isOperational: false,
      });
  }

  if (appError.isOperational) {
    logger.warn(
      {
        requestId: req.id,
        error: appError,
      },
      appError.message,
    );
  } else {
    logger.error(
      {
        requestId: req.id,
        err: error,
      },
      "Unexpected error",
    );
  }

  if (env.app.NODE_ENV !== "production") {
    logger.debug(error);
  }

  sendError(res, appError, req.id);
};