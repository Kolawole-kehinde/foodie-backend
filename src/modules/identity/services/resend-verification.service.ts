import { ConflictError } from "../../../shared/errors/ConflictError.js";
import type { RedisClient } from "../../../database/redis/client.js";
import type { ResendVerificationRequestDto } from "../dto/resend-verification-request.dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";

type ResendVerificationServiceDependencies = AuthDependencies & {
  redis: RedisClient;
};

const RESEND_COOLDOWN_SECONDS = 60;

const getResendCooldownKey = (email: string): string => {
  return `auth:email-verification:resend:${email}`;
};

export const createResendVerificationService = ({
  repositories,
  services,
  queues,
  redis,
}: ResendVerificationServiceDependencies) => {
  const resendVerification = async (
    dto: ResendVerificationRequestDto,
    context?: AuthContext,
  ): Promise<{ message: string }> => {
    const pendingRegistration =
      await repositories.pendingRegistration.findByEmail(dto.email);

    // Return a generic response when no pending registration exists.
    // This prevents email enumeration.
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
    // The OTP service replaces the previous OTP in Redis.
    const otp = await services.emailVerificationOtp.generate(dto.email);

    // Start the resend cooldown.
    await redis.set(
      cooldownKey,
      "1",
      "EX",
      RESEND_COOLDOWN_SECONDS,
    );

    await services.audit.log({
      action: "VERIFICATION_OTP_RESENT",
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