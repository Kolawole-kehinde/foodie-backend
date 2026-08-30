import type { RequestHandler } from "express";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import { createTokenService } from "../services/token.service.js";

const tokenService = createTokenService();

export const authenticate: RequestHandler = (req, _res, next) => {
  // 1. Get the Authorization header.
  const authorization = req.get("authorization");

  if (!authorization) {
    return next(new UnauthorizedError("Authentication required"));
  }
  
  // 2. The expected format is:
  // Authorization: Bearer <access-token>
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new UnauthorizedError("Invalid authorization header"));
  }

  try {
    // 3. Verify the access token.
    // jwt.verify() also checks whether the token has expired
    // and whether it was signed using our access-token secret.
    const payload = tokenService.verifyAccessToken(token);

    // 4. Attach the authenticated identity to the request.
    // Controllers and protected services can now access:
    // req.user.id
    // req.user.sessionId
    // req.user.roles
    req.user = {
      id: payload.userId,
      sessionId: payload.sessionId,
      roles: payload.roles,
    };

    // 5. Continue to the controller.
    return next();
  } catch {
    // Don't expose JWT verification details to the client.
    return next(new UnauthorizedError("Invalid or expired access token"));
  }
};
