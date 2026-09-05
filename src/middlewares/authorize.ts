import type { RequestHandler } from "express";
import { ForbiddenError } from "../shared/errors/ForbiddenError.js";
import type { RoleName } from "@prisma/client";


export const authorize = ( requiredRole: RoleName,): RequestHandler => {
    
  return (req, _res, next) => {
    if (!req.user) {
      return next(
        new ForbiddenError("Access denied"),
      );
    }

    if (!req.user.roles.includes(requiredRole)) {
      return next(
        new ForbiddenError("Insufficient permissions"),
      );
    }

    return next();
  };
};