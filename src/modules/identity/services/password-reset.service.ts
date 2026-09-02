import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import type { ForgotPasswordDto, ForgotPasswordResponseDto, ResetPasswordDto,} from "../dto/forgot-password-dto.js";
import type { AuthContext, AuthDependencies,} from "../types/auth.types.js";

export const createPasswordResetService = ({ repositories, services, prisma,}: AuthDependencies) => {

  // Request a password reset link for a user
  const passwordReset = async ( dto: ForgotPasswordDto, _context: AuthContext,): Promise<ForgotPasswordResponseDto> => {
    const { email } = dto;

    // Find the user associated with the provided email
    const user = await repositories.user.findByEmail(email);

    // Always return the same response to prevent email enumeration
    const genericResponse: ForgotPasswordResponseDto = {
      message:
        "If an account exists with this email, a password reset link has been sent.",
    };

    // If no user exists, return the generic response without revealing
    // whether the email is registered
    if (!user) {
      return genericResponse;
    }

    // Generate a cryptographically secure random reset token
    const token = services.token.generateRandomToken();

    // Store only the hash of the token in the database
    // The raw token will later be sent to the user via email
    const tokenHash = services.token.hashToken(token);

    // Reset tokens are valid for 30 minutes
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    // Store the hashed token and its expiration time
    await repositories.passwordResetToken.create({
      user: {
        connect: {
          id: user.id,
        },
      },
      tokenHash,
      expiresAt,
    });

    // Return the same generic response used when the user does not exist
    return genericResponse;
  };

  // Reset the user's password using a valid password reset token
  const resetPassword = async (
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> => {
    const { token, newPassword } = dto;

    // Hash the raw token so we can safely look it up in the database
    const tokenHash = services.token.hashToken(token);

    // Find the reset token using its hash
    const resetToken =
      await repositories.passwordResetToken.findByTokenHash(tokenHash);

    // Reject the request if the token does not exist
    if (!resetToken) {
      throw new UnauthorizedError(
        "Invalid or expired password reset token",
      );
    }

    // Prevent a reset token from being used more than once
    if (resetToken.usedAt) {
      throw new UnauthorizedError(
        "Invalid or expired password reset token",
      );
    }

    // Prevent the password from being changed with an expired token
    if (resetToken.expiresAt <= new Date()) {
      throw new UnauthorizedError(
        "Invalid or expired password reset token",
      );
    }

    // Hash the new password using the existing password service
    const passwordHash = await services.password.hash(newPassword);

    // Update the password, consume the reset token, and revoke
    // all existing sessions as one atomic database operation
    await prisma.$transaction(async (tx) => {
      // Update the user's password
      await tx.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          passwordHash,
        },
      });

      // Mark the reset token as used so it cannot be reused
      await tx.passwordResetToken.update({
        where: {
          id: resetToken.id,
        },
        data: {
          usedAt: new Date(),
        },
      });

      // Revoke all existing sessions after a successful password reset
      // so previously authenticated devices must log in again
      await tx.userSession.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null,
        },
        data: {
          revokedAt: new Date(),
          revokeReason: "PASSWORD_RESET",
        },
      });
    });

    // Confirm that the password has been successfully reset
    return {
      message: "Password reset successfully",
    };
  };

  return {
    passwordReset,
    resetPassword,
  };
};

export type PasswordResetService = ReturnType<typeof createPasswordResetService>;