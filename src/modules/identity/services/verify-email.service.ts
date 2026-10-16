
import { RoleName, UserStatus } from "@prisma/client";

import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { AuditActions } from "../constants/audit-action.constants.js";
import type { VerifyEmailRequestDto } from "../dto/verify-email-request.dto.js";
import { createAuditRepository } from "../repositories/audit.repository.js";
import { createPendingRegistrationRepository } from "../repositories/pending-registration.repository.js";
import { createUserRepository } from "../repositories/user.repository.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import { createAuditService } from "./audit.service.js";

export const createVerifyEmailService = ({
  prisma,
  repositories,
  services,
}: AuthDependencies) => {

  const verifyEmail = async ( dto: VerifyEmailRequestDto, context?: AuthContext): Promise<{ message: string }> => {

    const isValidOtp = await services.emailVerificationOtp.verify(
      dto.email,
      dto.otp,
    );

    if (!isValidOtp) {
      throw new ConflictError("Invalid or expired verification code");
    }

    const pendingRegistration =
      await repositories.pendingRegistration.findByEmail(dto.email);

    if (!pendingRegistration) {
      throw new ConflictError("Invalid or expired verification code");
    }

    await prisma.$transaction(async (tx) => {
      const userRepository = createUserRepository(tx);
      const pendingRegistrationRepository =
        createPendingRegistrationRepository(tx);
      const transactionAuditRepository = createAuditRepository(tx);
      const transactionAuditService = createAuditService(
        transactionAuditRepository,
      );

      const createdUser = await userRepository.create({
        email: pendingRegistration.email,
        passwordHash: pendingRegistration.passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
        roles: {
          create: {
            role: {
              connect: { name: RoleName.USER },
            },
          },
        },
      });

      await transactionAuditService.log({
        action: AuditActions.EMAIL_VERIFIED,
        userId: createdUser.id,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });

      await pendingRegistrationRepository.deleteById(
        pendingRegistration.id,
      );
    });

    return {
      message: "Email verified successfully.",
    };
  };

  return { verifyEmail };
};

export type VerifyEmailService = ReturnType<
  typeof createVerifyEmailService
>;
