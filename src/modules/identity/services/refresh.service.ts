import { SecurityEventSeverity, SecurityEventType, SessionRevocationReason, UserStatus } from "@prisma/client";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import type { RefreshResponseDto } from "../dto/refresh-response.dto.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import { ForbiddenError } from "../../../shared/errors/ForbiddenError.js";
import { AUTH_SECURITY } from "../constants/auth.constants.js";
import { createRefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { RefreshTokenAlreadyRotatedError } from "../../../shared/errors/RefreshTokenAlreadyRotatedError.js";


export const createRefreshService = ({
  repositories,
  services,
  prisma,
}: AuthDependencies) => {
  const refresh = async (
    refreshToken: string,
    context: AuthContext,
  ): Promise<RefreshResponseDto> => {
    const now = new Date();

    // 1. Hash the raw refresh token
    const tokenHash = services.token.hashToken(refreshToken);

    // 2. Find refresh token + session + user
    const storedToken =
      await repositories.refreshToken.findByTokenHash(tokenHash);

    // 3. Token doesn't exist
    if (!storedToken) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    const session = storedToken.session;

    // 4. Detect refresh-token reuse
    if (storedToken.revokedAt) {
  if (storedToken.replacedByTokenId) {
    await repositories.session.revoke(
      session.id,
      SessionRevocationReason.TOKEN_REUSE_DETECTED,
    );

    await services.securityEvent.record({
      userId: session.user.id,
      type: SecurityEventType.REFRESH_TOKEN_REUSED,
      severity: SecurityEventSeverity.CRITICAL,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        sessionId: session.id,
        refreshTokenId: storedToken.id,
      },
    });
  }

  throw new UnauthorizedError("Invalid refresh token");
}

    // 5. Check refresh token expiration
    if (storedToken.expiresAt <= now) {
      await repositories.refreshToken.revoke(storedToken.id);

      throw new UnauthorizedError("Invalid refresh token");
    }

    // 6. Check session revocation
    if (session.revokedAt) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // 7. Check session expiration
    if (session.expiresAt <= now) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    // 8. Check account status
    const user = session.user;

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenError("Your account has been suspended");
    }

    // 9. Get user's roles
    const roles = user.roles.map((userRole) => userRole.role.name);

    // 10. Generate new refresh token
    const newRefreshToken = services.token.generateRandomToken();

    const newRefreshTokenHash = services.token.hashToken(newRefreshToken);

    // 11. Calculate new refresh-token expiration
    const newRefreshTokenExpiresAt = new Date(
      now.getTime() + AUTH_SECURITY.REFRESH_TOKEN_DURATION_MS,
    );

    // 12. Atomically rotate refresh token
   try {
  await prisma.$transaction(async (tx) => {
    const refreshTokenRepository =
      createRefreshTokenRepository(tx);

    return refreshTokenRepository.rotate({
      oldTokenId: storedToken.id,
      sessionId: session.id,
      newTokenHash: newRefreshTokenHash,
      newTokenExpiresAt: newRefreshTokenExpiresAt,
    });
  });
} catch (error) {
  if (error instanceof RefreshTokenAlreadyRotatedError) {
    // Another request already rotated this token.
    // Treat this as a potential refresh-token replay.

    await repositories.session.revoke(
      session.id,
      SessionRevocationReason.TOKEN_REUSE_DETECTED,
    );

    await services.securityEvent.record({
      userId: user.id,
      type: SecurityEventType.REFRESH_TOKEN_REUSED,
      severity: SecurityEventSeverity.CRITICAL,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        sessionId: session.id,
        refreshTokenId: storedToken.id,
      },
    });

    throw new UnauthorizedError("Invalid refresh token");
  }

  throw error;
}
    // 13. Create new access token
    const accessToken = services.token.createAccessToken({
      userId: user.id,
      sessionId: session.id,
      roles,
    });

    // 14. Return new authentication result
    return {
      accessToken,
      expiresIn: 15 * 60,

      user: {
        id: user.id,
        email: user.email,
        roles,
      },
    };
  };

  return {
    refresh,
  };
};

export type RefreshService = ReturnType<typeof createRefreshService>;
