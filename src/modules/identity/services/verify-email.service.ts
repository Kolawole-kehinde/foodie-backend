import { RoleName, UserStatus } from "@prisma/client";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import type { VerifyEmailRequestDto } from "../dto/verify-email-request.dto.js";
import { createPendingRegistrationRepository } from "../repositories/pending-registration.repository.js";
import { createUserRepository } from "../repositories/user.repository.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import { AuditActions } from "../constants/audit-action.constants.js";



export const createVerifyEmailService = ({prisma,repositories,services,}: AuthDependencies) => {

  const verifyEmail = async (dto: VerifyEmailRequestDto,
    context?: AuthContext): Promise<{ message: string }> => {


    // Verify the OTP stored in Redis.
    // The OTP service also handles expiration and failed-attempt limits.
    const isValidOtp = await services.emailVerificationOtp.verify(
      dto.email,
      dto.otp,
    );

    if (!isValidOtp) {
      throw new ConflictError("Invalid or expired verification code");
    }

    // Find the pending registration using the email.
    const pendingRegistration = await repositories.pendingRegistration.findByEmail(dto.email);

    if (!pendingRegistration) {
      throw new ConflictError("Invalid or expired verification code");
    }

    // Create the real user and remove the pending registration
    // in the same database transaction.
    const user = await prisma.$transaction(async (tx) => {
      const userRepository = createUserRepository(tx);

      const pendingRegistrationRepository =
        createPendingRegistrationRepository(tx);

      const createdUser = await userRepository.create({
        email: pendingRegistration.email,
        passwordHash: pendingRegistration.passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),

        roles: {
          create: {
            role: {
              connect: {
                name: RoleName.USER,
              },
            },
          },
        },
      });

      await pendingRegistrationRepository.deleteById(pendingRegistration.id);

      return createdUser;
    });

    await services.audit.log({
      action: AuditActions.EMAIL_VERIFIED,
      userId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return {
      message: "Email verified successfully.",
    };
  };

  return {
    verifyEmail,
  };
};

export type VerifyEmailService = ReturnType<typeof createVerifyEmailService>;
