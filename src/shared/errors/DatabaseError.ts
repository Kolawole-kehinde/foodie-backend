import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";

export class DatabaseError extends AppError{
  constructor(message = "Database operation failed") {
    super(message, {
      statusCode: 500,
      code: ERROR_CODES.DATABASE_ERROR,
    });
  }
}