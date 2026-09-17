import { SessionRevocationReason } from "@prisma/client";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import { createRefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { createUserSessionRepository } from "../repositories/user-session.repository.js";



export const createLogoutService = ({repositories,services, prisma}: AuthDependencies) => {

 const logout = async (
  refreshToken: string,
  context: AuthContext,
) => {
  const tokenHash = services.token.hashToken(refreshToken);

  const storedToken =
    await repositories.refreshToken.findByTokenHash(tokenHash);

  if (!storedToken) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const session = storedToken.session;

  await prisma.$transaction(async (tx) => {
    const refreshTokenRepository = createRefreshTokenRepository(tx);
    const sessionRepository = createUserSessionRepository(tx);

    if (!storedToken.revokedAt) {
      await refreshTokenRepository.revoke(storedToken.id);
    }

    if (!session.revokedAt) {
      await sessionRepository.revoke(
        session.id,
        SessionRevocationReason.USER_LOGOUT,
      );
    }
  });

  return {
    message: "Logged out successfully",
  };
};

  return {
    logout,
  };
};

export type LogoutService = ReturnType<typeof createLogoutService>;
