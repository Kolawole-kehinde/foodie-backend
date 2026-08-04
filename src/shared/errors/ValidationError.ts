import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";


export class ValidationError extends AppError {
  constructor(
    message = "Validation failed",
    details?: unknown,
  ) {
    super(message, {
      statusCode: 400,
      code: ERROR_CODES.VALIDATION_ERROR,
      details,
    });
  }
}