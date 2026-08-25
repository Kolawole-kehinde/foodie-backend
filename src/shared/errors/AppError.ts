import type { ErrorCode } from "../constants/error-codes.js";

export interface AppErrorOptions {
  statusCode: number;
  code: ErrorCode;
  isOperational?: boolean;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, options: AppErrorOptions) {
    super(message);

    this.name = this.constructor.name;
    this.statusCode = options.statusCode;
    this.code = options.code;
    this.isOperational = options.isOperational ?? true;
    this.details = options.details;

    Error.captureStackTrace?.(this, this.constructor);
  }
}