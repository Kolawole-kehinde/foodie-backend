
import { randomUUID } from "node:crypto";

import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { AuditActions } from "../constants/audit-action.constants.js";
import type { ResendVerificationRequestDto } from "../dto/resend-verification-request.dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";

const RESEND_COOLDOWN_SECONDS = 60;

const getResendCooldownKey = (email: string): string => {
  return `auth:email-verification:resend:${email}`;
};

const RELEASE_COOLDOWN_SCRIPT = `
  if redis.call("GET", KEYS[1]) == ARGV[1] then
    return redis.call("DEL", KEYS[1])
  end

  return 0
`;

const GENERIC_RESPONSE = {
  message:
    "If the email is associated with a pending registration, a verification code has been sent.",
};

export const createResendVerificationService = ({
  repositories,
  services,
  queues,
  redis,
}: AuthDependencies) => {
  const resendVerification = async (
    dto: ResendVerificationRequestDto,
    context?: AuthContext,
  ): Promise<{ message: string }> => {
    const email = dto.email;

    const pendingRegistration =
      await repositories.pendingRegistration.findByEmail(email);

    if (!pendingRegistration) {
      return GENERIC_RESPONSE;
    }

    const cooldownKey = getResendCooldownKey(email);
    const cooldownToken = randomUUID();

    // Atomically claim the cooldown so concurrent requests cannot
    // all pass a separate EXISTS check.
    const cooldownClaimed = await redis.set(
      cooldownKey,
      cooldownToken,
      "EX",
      RESEND_COOLDOWN_SECONDS,
      "NX",
    );

    if (cooldownClaimed !== "OK") {
      throw new ConflictError(
        "Please wait before requesting another verification code",
      );
    }

    try {
      const otp = await services.emailVerificationOtp.generate(email);

      await queues.email.sendVerificationEmail(email, otp);

      await services.audit.log({
        action: AuditActions.VERIFICATION_OTP_RESENT,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { email },
      });

      return GENERIC_RESPONSE;
    } catch (error) {
      // Release only our own cooldown. If it expired and another
      // request claimed a new cooldown, do not delete that claim.
      try {
        await redis.eval(
          RELEASE_COOLDOWN_SCRIPT,
          1,
          cooldownKey,
          cooldownToken,
        );
      } catch (releaseError) {
        console.error(
          "[Identity] Failed to release verification resend cooldown",
          {
            error:
              releaseError instanceof Error
                ? releaseError.message
                : "Unknown error",
          },
        );
      }

      throw error;
    }
  };

  return { resendVerification };
};

export type ResendVerificationService = ReturnType<
  typeof createResendVerificationService
>;
