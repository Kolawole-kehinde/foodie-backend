
import { randomUUID } from "node:crypto";
import { RoleName, UserStatus } from "@prisma/client";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { IdentityEmailVerifiedEvent } from "../../../shared/events/event.types.js";
import type { VerifyEmailRequestDto } from "../dto/verify-email-request.dto.js";
import { createPendingRegistrationRepository } from "../repositories/pending-registration.repository.js";
import { createUserRepository } from "../repositories/user.repository.js";
import { createOutboxRepository } from "../../outbox/repositories/outbox.repository.js";
import type { AuthContext, AuthDependencies } from "../types/auth.types.js";
import { AuditActions } from "../constants/audit-action.constants.js";

export const createVerifyEmailService = ({ prisma, repositories, services, outboxService,}: AuthDependencies) => {

  const verifyEmail = async (
 dto: VerifyEmailRequestDto,
    context?: AuthContext,
  ): Promise<{ message: string }> => {

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

    const user = await prisma.$transaction(async (tx) => {
      const userRepository = createUserRepository(tx);
      const pendingRegistrationRepository = createPendingRegistrationRepository(tx);
      const transactionOutboxRepository = createOutboxRepository(tx);

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

      const event: IdentityEmailVerifiedEvent = {
        eventId: randomUUID(),
        eventType: EVENT_TYPES.IDENTITY_EMAIL_VERIFIED,
        occurredAt: new Date().toISOString(),
        aggregateType: "identity",
        aggregateId: createdUser.id,
        data: {
          userId: createdUser.id,
          email: createdUser.email,
        },
      };

      await outboxService.createEvent({
        event,
        repository: transactionOutboxRepository,
      });

      await pendingRegistrationRepository.deleteById(
        pendingRegistration.id,
      );

      return createdUser;
    });

    await services.audit.log({
      action: AuditActions.EMAIL_VERIFIED,
      userId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    return { message: "Email verified successfully." };
  };

  return { verifyEmail };
};

export type VerifyEmailService = ReturnType<
  typeof createVerifyEmailService
>;
