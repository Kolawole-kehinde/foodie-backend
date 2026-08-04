import { ZodError } from "zod";
import { ValidationError } from "./ValidationError.js";


export function mapZodError(error: ZodError): ValidationError {
  return new ValidationError(
    "Validation failed",
    error.flatten().fieldErrors,
  );
}