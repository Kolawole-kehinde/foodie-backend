
import { env } from "../../../config/env.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";

import type {
  ForgotPasswordDto,
  ForgotPasswordResponseDto,
  ResetPasswordDto,
} from "../dto/forgot-password-dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";

export const createPasswordResetService = ({
  repositories,
  services,
  prisma,
  queues,
}: AuthDependencies) => {
  const passwordReset = async (
    dto: ForgotPasswordDto,
    _context: AuthContext,
  ): Promise<ForgotPasswordResponseDto> => {
    const genericResponse: ForgotPasswordResponseDto = {
      message:
        "If an account exists with this email, a password reset link has been sent.",
    };

    const user = await repositories.user.findByEmail(dto.email);

    if (!user) {
      return genericResponse;
    }

    const token = services.token.generateRandomToken();
    const tokenHash = services.token.hashToken(token);

    const expiresAt = new Date(
      Date.now() +
        env.auth.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000,
    );

    await repositories.passwordResetToken.create({
      user: { connect: { id: user.id } },
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${env.frontend}/reset-password?token=${encodeURIComponent(token)}`;

    await queues.email.sendForgotPasswordEmail(user.email, resetUrl);

    return genericResponse;
  };

  const resetPassword = async (
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> => {
    const tokenHash = services.token.hashToken(dto.token);

    const resetToken =
      await repositories.passwordResetToken.findByTokenHash(tokenHash);

    if (
      !resetToken ||
      resetToken.usedAt ||
      resetToken.expiresAt <= new Date()
    ) {
      throw new UnauthorizedError("Invalid or expired password reset token");
    }

    const passwordHash = await services.password.hash(dto.newPassword);
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      });

      if (claimed.count !== 1) {
        throw new UnauthorizedError("Invalid or expired password reset token");
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      });

      await tx.userSession.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: "PASSWORD_RESET",
        },
      });
    });

    return { message: "Password reset successfully" };
  };

  return { passwordReset, resetPassword };
};

export type PasswordResetService = ReturnType<
  typeof createPasswordResetService
>;
