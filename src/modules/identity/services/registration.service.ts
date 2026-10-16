import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { logger } from "../../../config/logger.js";
import { AuditActions } from "../constants/audit-action.constants.js";
import { AUTH_EXPIRATION } from "../constants/auth.constants.js";
import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { RegisterResponseDto } from "../dto/register-response.dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";

export const createRegistrationService = ({
  repositories,
  services,
  queues,
}: AuthDependencies) => {
  const register = async (
    dto: RegisterRequestDto,
    context?: AuthContext,
  ): Promise<RegisterResponseDto> => {
    const { email, password } = dto;

    const existingUser = await repositories.user.findByEmail(email);

    if (existingUser) {
      throw new ConflictError("Email already exists");
    }

    const existingPending =
      await repositories.pendingRegistration.findByEmail(email);

    if (existingPending) {
      throw new ConflictError(
        "A registration for this email is already pending verification",
      );
    }

    const passwordHash = await services.password.hash(password);
    const now = Date.now();

    const pendingRegistration = await repositories.pendingRegistration.create({
      email,
      passwordHash,
      expiresAt: new Date(now + AUTH_EXPIRATION.PENDING_REGISTRATION_MS),
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    try {
      const verificationOtp =
        await services.emailVerificationOtp.generate(email);

      await queues.email.sendVerificationEmail(email, verificationOtp);

      await services.audit.log({
        action: AuditActions.REGISTRATION_INITIATED,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { email },
      });

      return {
        message: "Registration successful. Please verify your email.",
      };
    } catch (error) {
      try {
        await services.emailVerificationOtp.invalidate(email);
        await repositories.pendingRegistration.deleteById(
          pendingRegistration.id,
        );
      } catch (cleanupError) {
        logger.error(
          {
            error:
              cleanupError instanceof Error
                ? cleanupError.message
                : "Unknown cleanup error",
          },
          "Failed to clean up pending registration after delivery failure",
        );
      }

      throw error;
    }
  };

  return { register };
};

export type RegistrationService = ReturnType<typeof createRegistrationService>;
