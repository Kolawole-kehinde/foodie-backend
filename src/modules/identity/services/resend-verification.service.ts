import { randomUUID } from "node:crypto";

import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { logger } from "../../../config/logger.js";
import { AuditActions } from "../constants/audit-action.constants.js";
import type { ResendVerificationRequestDto } from "../dto/resend-verification-request.dto.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";

const RESEND_COOLDOWN_SECONDS = 60;

const getResendCooldownKey = (email: string): string =>
  `auth:email-verification:resend:${email}`;

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
    const pendingRegistration =
      await repositories.pendingRegistration.findByEmail(dto.email);

    if (!pendingRegistration) {
      return GENERIC_RESPONSE;
    }

    const cooldownKey = getResendCooldownKey(dto.email);
    const cooldownToken = randomUUID();

    const claimed = await redis.set(
      cooldownKey,
      cooldownToken,
      "EX",
      RESEND_COOLDOWN_SECONDS,
      "NX",
    );

    if (claimed !== "OK") {
      throw new ConflictError(
        "Please wait before requesting another verification code",
      );
    }

    try {
      const otp = await services.emailVerificationOtp.generate(dto.email);

      await queues.email.sendVerificationEmail(dto.email, otp);

      await services.audit.log({
        action: AuditActions.VERIFICATION_OTP_RESENT,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
        metadata: { email: dto.email },
      });

      return GENERIC_RESPONSE;
    } catch (error) {
      try {
        await redis.eval(
          RELEASE_COOLDOWN_SCRIPT,
          1,
          cooldownKey,
          cooldownToken,
        );
      } catch (cleanupError) {
        logger.error(
          {
            error:
              cleanupError instanceof Error
                ? cleanupError.message
                : "Unknown cooldown cleanup error",
          },
          "Failed to release verification resend cooldown",
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
