import type { RequestHandler } from "express";
import { ForbiddenError } from "../shared/errors/ForbiddenError.js";
import type { AuthorizationService } from "../modules/identity/services/authorization.service.js";

type AuthorizePermissionDependencies = {
  authorizationService: AuthorizationService;
};

export const createAuthorizePermission = ({ authorizationService,}: AuthorizePermissionDependencies) => {
  const authorizePermission = (requiredPermission: string): RequestHandler => {
    return async (req, _res, next) => {
      try {
        if (!req.user) {
          return next(new ForbiddenError("Access denied"));
        }

        const hasPermission = await authorizationService.hasPermission(
          req.user.id,
          requiredPermission,
        );

        if (!hasPermission) {
          return next(new ForbiddenError("Insufficient permissions"));
        }

        return next();
      } catch (error) {
        return next(error);
      }
    };
  };

  return authorizePermission;
};

export type AuthorizePermission = ReturnType<typeof createAuthorizePermission>;
