import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, {
      statusCode: 403,
      code: ERROR_CODES.FORBIDDEN,
    });
  }
}