import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, {
      statusCode: 401,
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }
}