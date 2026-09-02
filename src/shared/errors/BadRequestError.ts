import { ERROR_CODES } from "../constants/error-codes.js";
import { AppError } from "./AppError.js";

export class BadRequestError extends AppError {
  constructor(message = "Badreqeust") {
    super(message, {
      statusCode: 400,
      code: ERROR_CODES.BADREQUEST
    });
  }
}