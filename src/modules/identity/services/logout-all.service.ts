import { createRefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { createUserSessionRepository } from "../repositories/user-session.repository.js";
import type { AuthDependencies } from "../types/auth.types.js";



  // Logout-all-devices must revoke both sessions and refresh tokens.
    // I use a transaction so both operations succeed together.
    // If one operation fails, the entire transaction is rolled back.

export const createLogoutAllDevicesService = ({prisma,}: AuthDependencies) => {
  const logoutAllDevices = async (userId: string) => {
  
    return prisma.$transaction(async (tx) => {

      const sessionRepository = createUserSessionRepository(tx);
      const refreshTokenRepository = createRefreshTokenRepository(tx);

      // 1. Revoke all active sessions belonging to the user.
      const sessions = await sessionRepository.revokeAllForUser(userId)

      // 2. Revoke all active refresh tokens belonging to the user.
      const refreshTokens = await refreshTokenRepository.revokeAllByUserId(userId);

      // Return useful information about what was revoked.
      return {
        sessionsRevoked: sessions.count,
        refreshTokensRevoked: refreshTokens.count,
      };
    });
  };

  return {
    logoutAllDevices,
  };
};

export type LogoutAllDevicesService = ReturnType< typeof createLogoutAllDevicesService>;