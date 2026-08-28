import { SessionRevocationReason } from "@prisma/client";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";



export const createLogoutService = ({repositories,services,}: AuthDependencies) => {

  const logout = async (refreshToken: string, context: AuthContext) => {

    const tokenHash = services.token.hashToken(refreshToken);

    const storedToken = await repositories.refreshToken.findByTokenHash(tokenHash);

    // Don't reveal whether the token exists.
    if (!storedToken) {
      throw new UnauthorizedError("Invalid refresh token");
    }

    const session = storedToken.session;

    // Revoke the refresh token if it is still active.
    if (!storedToken.revokedAt) {
      await repositories.refreshToken.revoke(storedToken.id);
    }

    // Revoke the session.
    if (!session.revokedAt) {
      await repositories.session.revoke(
        session.id,
        SessionRevocationReason.USER_LOGOUT,
      );
    }

    return {
      message: "Logged out successfully",
    };
  };

  return {
    logout,
  };
};

export type LogoutService = ReturnType<typeof createLogoutService>;
