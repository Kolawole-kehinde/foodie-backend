import type { RequestHandler } from "express";
import { UnauthorizedError } from "../shared/errors/UnauthorizedError.js";
import type { SessionService } from "../modules/identity/services/session.service.js";
import type { TokenService } from "../modules/identity/services/token.service.js";

type AuthenticateDependencies = {
  tokenService: TokenService;
  sessionService: SessionService;
};

export const createAuthenticate = ({
  tokenService,
  sessionService,
}: AuthenticateDependencies): RequestHandler => {
  return async (req, _res, next) => {
    // 1. Get the Authorization header.
    const authorization = req.get("authorization");

    if (!authorization) {
      return next(
        new UnauthorizedError("Authentication required"),
      );
    }

    // 2. Expected format:
    // Authorization: Bearer <access-token>
    const [scheme, token] = authorization.split(" ");

    if (scheme !== "Bearer" || !token) {
      return next(
        new UnauthorizedError("Invalid authorization header"),
      );
    }

    try {
      // 3. Verify the JWT.
      // This checks:
      // - signature
      // - expiration
      // - token structure
      const payload = tokenService.verifyAccessToken(token);

      // 4. Check that the session is still active.
      //
      // This is important because a JWT can still be cryptographically
      // valid even after the user has logged out or all sessions have
      // been revoked.
      await sessionService.validateSession(
        payload.sessionId,
      );

      // 5. Attach the authenticated identity to the request.
      req.user = {
        id: payload.userId,
        sessionId: payload.sessionId,
        roles: payload.roles,
      };

      // 6. Continue to the protected route.
      return next();
    } catch (error) {
      // Don't expose JWT/session validation details.
      if (error instanceof UnauthorizedError) {
        return next(error);
      }

      return next(
        new UnauthorizedError(
          "Invalid or expired access token",
        ),
      );
    }
  };
};