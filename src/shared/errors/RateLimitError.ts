import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";

export class RateLimitError extends AppError {
  constructor(
    message = "Too many requests. Please try again later.",
  ) {
    super(message, {
      statusCode: 429,
      code: ERROR_CODES.RATE_LIMITED,
    });
  }
}