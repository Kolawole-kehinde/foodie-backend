import { LoginFailureReason } from "@prisma/client";
import type { LoginRequestDto } from "../dto/login-request.dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import { AUTH_SECURITY } from "../constants/auth.constants.js";
import { createRefreshTokenRepository } from "../repositories/refresh-token.repository.js";
import { createUserSessionRepository } from "../repositories/user-session.repository.js";
import type { LoginResponseDto } from "../dto/login-response.dto.js";

export const createLoginService = ({
  repositories,
  services,
  prisma,
}: AuthDependencies) => {
  const login = async (
    dto: LoginRequestDto,
    context: AuthContext,
  ): Promise<LoginResponseDto> => {
    const now = new Date();

    const { email, password } = dto;

    // 1. Find user

    const user = await repositories.user.findByEmail(email);

    // Always use a real or dummy hash
    const passwordHash = user?.passwordHash ?? services.password.getDummyHash();

    // Always perform password verification
    const passwordValid = await services.password.verify(
      password,
      passwordHash,
    );

    // User doesn't exist
    if (!user) {
      await repositories.loginAttempt.create({
        email,
        success: false,
        failureReason: LoginFailureReason.USER_NOT_FOUND,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new UnauthorizedError("Invalid email or password");
    }

    // Check account lock AFTER password verification
    if (user.lockedUntil) {
      if (user.lockedUntil > now) {
        await repositories.loginAttempt.create({
          userId: user.id,
          email,
          success: false,
          failureReason: LoginFailureReason.ACCOUNT_LOCKED,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        throw new UnauthorizedError("Invalid email or password");
      }

      // Lock expired
      await repositories.user.resetFailedLoginAttempts(user.id);
    }

    // Invalid password
    if (!passwordValid) {
      const failedAttempt = await repositories.user.recordFailedLoginAttempt(
        user.id,
      );

      await repositories.loginAttempt.create({
        userId: user.id,
        email,
        success: false,
        failureReason: LoginFailureReason.INVALID_PASSWORD,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      if (failedAttempt.locked) {
        // Security event can be added later
      }

      throw new UnauthorizedError("Invalid email or password");
    }
    // 7. Successful authentication
    await repositories.user.resetFailedLoginAttempts(user.id);

    // 8. Update last login
    await repositories.user.update(user.id, {
      lastLoginAt: now,
    });

    // 9. Record successful login
    await repositories.loginAttempt.create({
      userId: user.id,
      email,
      success: true,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    // 10. Generate refresh token
    const refreshToken = services.token.generateRandomToken();

    const refreshTokenHash = services.token.hashToken(refreshToken);

    // 11. Calculate expiration
    const sessionExpiresAt = new Date(
      now.getTime() + AUTH_SECURITY.SESSION_DURATION_MS,
    );

    const refreshTokenExpiresAt = new Date(
      now.getTime() + AUTH_SECURITY.REFRESH_TOKEN_DURATION_MS,
    );

    // 12. Create session + refresh token atomically
    const session = await prisma.$transaction(async (tx) => {
      const sessionRepository = createUserSessionRepository(tx);

      const refreshTokenRepository = createRefreshTokenRepository(tx);

      const session = await sessionRepository.create({
        user: {
          connect: {
            id: user.id,
          },
        },

        deviceName: context.deviceName,
        userAgent: context.userAgent,
        ipAddress: context.ipAddress,
        lastActivityAt: now,
        expiresAt: sessionExpiresAt,
      });

      await refreshTokenRepository.create({
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        session: {
          connect: {
            id: session.id,
          },
        },
      });

      return session;
    });

    // 13. Create access token
    const roles = user.roles.map((userRole) => userRole.role.name);

    const accessToken = services.token.createAccessToken({
      userId: user.id,
      sessionId: session.id,
      roles,
    });

    // 14. Return authentication result

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  };

  return {
    login,
  };
};

export type LoginService = ReturnType<typeof createLoginService>;
