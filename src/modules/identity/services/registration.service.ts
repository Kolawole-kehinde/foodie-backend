
import { ConflictError } from "../../../shared/errors/ConflictError.js";

import { AuditActions } from "../constants/audit-action.constants.js";
import { AUTH_EXPIRATION } from "../constants/auth.constants.js";
import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { RegisterResponseDto } from "../dto/register-response.dto.js";
import type {
  AuthContext,
  AuthDependencies,
} from "../types/auth.types.js";

export const createRegistrationService = ({repositories,services,queues,}: AuthDependencies) => {

  const register = async (dto: RegisterRequestDto,context?: AuthContext,): Promise<RegisterResponseDto> => {
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

    await repositories.pendingRegistration.create({
      email,
      passwordHash,

      expiresAt: new Date(
        now + AUTH_EXPIRATION.PENDING_REGISTRATION_MS,
      ),

      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    // Generate and store the OTP in Redis.
    // Only the hashed OTP is stored; the raw OTP is returned
    // so it can be sent to the user's email.
    const verificationOtp = await services.emailVerificationOtp.generate(email);

    await services.audit.log({
      action: AuditActions.REGISTRATION_INITIATED,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        email,
      },
    });

    await queues.email.sendVerificationEmail(
      email,
      verificationOtp,
    );

    return {
      message:
        "Registration successful. Please verify your email.",
    };
  };

  return {
    register,
  };
};

export type RegistrationService = ReturnType<
  typeof createRegistrationService
>;