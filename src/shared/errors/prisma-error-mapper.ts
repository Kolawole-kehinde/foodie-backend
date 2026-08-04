import {
  PrismaClientKnownRequestError,
  PrismaClientValidationError,
} from "@prisma/client/runtime/library";
import { ConflictError } from "./ConflictError.js";
import { NotFoundError } from "./NotFoundError.js";
import { DatabaseError } from "./DatabaseError.js";


export function mapPrismaError(error: unknown) {
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return new ConflictError("Resource already exists");

      case "P2025":
        return new NotFoundError("Resource not found");

      default:
        return new DatabaseError();
    }
  }

  if (error instanceof PrismaClientValidationError) {
    return new DatabaseError("Invalid database query");
  }

  return null;
}