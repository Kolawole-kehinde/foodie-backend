import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";

export class RefreshTokenAlreadyRotatedError extends AppError {
  constructor(message = "Refresh token has already been rotated") {
    super(message, {
      statusCode: 401,
      code: ERROR_CODES.UNAUTHORIZED,
    });
  }
}