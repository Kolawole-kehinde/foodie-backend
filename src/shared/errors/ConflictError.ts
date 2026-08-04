import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";


export class ConflictError extends AppError {
  constructor(message = "Resource already exists") {
    super(message, {
      statusCode: 409,
      code: ERROR_CODES.CONFLICT,
    });
  }
}