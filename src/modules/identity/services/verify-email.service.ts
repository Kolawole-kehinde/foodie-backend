import { RoleName, UserStatus } from "@prisma/client";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import type { VerifyEmailRequestDto } from "../dto/verify-email-request.dto.js";
import { createPendingRegistrationRepository } from "../repositories/pending-registration.repository.js";
import { createUserRepository } from "../repositories/user.repository.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import { AuditActions } from "../constants/audit-action.constants.js";

export const createVerifyEmailService = ({
  prisma,
  repositories,
  services,
}: AuthDependencies) => {
  const verifyEmail = async (
    dto: VerifyEmailRequestDto,
    context?: AuthContext
  ): Promise<{ message: string }> => {
    const tokenHash =
      services.token.hashToken(dto.token);

    const pendingRegistration = await repositories.pendingRegistration.findByTokenHash(
        tokenHash
      );

    if (!pendingRegistration) {
      throw new ConflictError(
        "Invalid or expired verification token"
      );
    }

    if (pendingRegistration.verificationTokenExpiresAt <=new Date()) {
      throw new ConflictError(
        "Invalid or expired verification token"
      );
    }

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

  await pendingRegistrationRepository.deleteById(
    pendingRegistration.id
  );

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