import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { AuditActions } from "../constants/audit-action.constants.js";
import type { ResendVerificationRequestDto } from "../dto/resend-verification-request.dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";

const RESEND_COOLDOWN_SECONDS = 60;

const getResendCooldownKey = (email: string): string => {
  return `auth:email-verification:resend:${email}`;
};

export const createResendVerificationService = ({repositories, services,queues,redis,}: AuthDependencies) => {

  const resendVerification = async ( dto: ResendVerificationRequestDto, context?: AuthContext,): Promise<{ message: string }> => {
    const pendingRegistration =
      await repositories.pendingRegistration.findByEmail(dto.email);

    // Do not reveal whether the email has a pending registration.
    if (!pendingRegistration) {
      return {
        message:
          "If the email is associated with a pending registration, a verification code has been sent.",
      };
    }

    const cooldownKey = getResendCooldownKey(dto.email);

    const cooldownExists = await redis.exists(cooldownKey);

    if (cooldownExists) {
      throw new ConflictError(
        "Please wait before requesting another verification code",
      );
    }

    // Generate a new OTP.
    // This replaces the previous OTP stored in Redis.
    const otp = await services.emailVerificationOtp.generate(dto.email);

    // Prevent another resend for 60 seconds.
    await redis.set(cooldownKey, "1", "EX", RESEND_COOLDOWN_SECONDS);

    await services.audit.log({
      action: AuditActions.VERIFICATION_OTP_RESENT,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        email: dto.email,
      },
    });

    await queues.email.sendVerificationEmail(dto.email, otp);

    return {
      message:
        "If the email is associated with a pending registration, a verification code has been sent.",
    };
  };

  return {
    resendVerification,
  };
};

export type ResendVerificationService = ReturnType<
  typeof createResendVerificationService
>;
