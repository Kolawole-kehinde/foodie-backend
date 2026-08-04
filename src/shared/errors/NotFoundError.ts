import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";


export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, {
      statusCode: 404,
      code: ERROR_CODES.NOT_FOUND,
    });
  }
}