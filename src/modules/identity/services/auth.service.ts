import type { PrismaClient } from "@prisma/client";
import {
  createPendingRegistrationRepository,
  type PendingRegistrationRepository,
} from "../repositories/pending-registration.repository.js";
import type { UserRepository } from "../repositories/user.repository.js";
import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";
import type { AuditService } from "./audit.service.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { AuditActions } from "../constants/audit-action.constants.js";
import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { RegisterResponseDto } from "../dto/register-response.dto.js";
import type { EmailQueueService } from "../../../queues/email/email.service.js";



type CreateAuthServiceDependencies = {
  prisma: PrismaClient;
  userRepository: UserRepository;
  pendingRegistrationRepository: PendingRegistrationRepository;
  passwordService: PasswordService;
  tokenService: TokenService;
  auditService: AuditService;
  emailQueueService: EmailQueueService;
};

type RegisterContext = {
  ipAddress?: string;
  userAgent?: string;
};

export const createAuthService = ({
  prisma,
  userRepository,
  pendingRegistrationRepository,
  passwordService,
  tokenService,
  auditService,
   emailQueueService,
}: CreateAuthServiceDependencies) => {
  const register = async (
    dto: RegisterRequestDto,
    context?: RegisterContext
  ): Promise<RegisterResponseDto> => {
    const { email, password } = dto;

    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictError("Email already exists");
    }

    const existingPendingRegistration =
      await pendingRegistrationRepository.findByEmail(email);

    if (existingPendingRegistration) {
      throw new ConflictError(
        "A registration for this email is already pending verification"
      );
    }

    const passwordHash = await passwordService.hash(password);

    const verificationToken = tokenService.generateRandomToken();

    const verificationTokenHash =
      tokenService.hashToken(verificationToken);

    const verificationTokenExpiresAt = new Date(
      Date.now() + 1000 * 60 * 30
    );

    /**
     * Build the optional request context once.
     *
     * With `exactOptionalPropertyTypes: true`, we must not
     * explicitly pass:
     *
     *   ipAddress: undefined
     *
     * Instead, the property is omitted completely when undefined.
     */
    const registrationContext: RegisterContext = {
      ...(context?.ipAddress !== undefined
        ? { ipAddress: context.ipAddress }
        : {}),
      ...(context?.userAgent !== undefined
        ? { userAgent: context.userAgent }
        : {}),
    };

    await prisma.$transaction(async (tx) => {
      const pendingRegistrationRepositoryTx =
        createPendingRegistrationRepository(tx);

      await pendingRegistrationRepositoryTx.create({
        email,
        passwordHash,
        verificationTokenHash,
        verificationTokenExpiresAt,
        ...registrationContext,
      });
    });

    await auditService.log({
      action: AuditActions.REGISTRATION_INITIATED,
      ...registrationContext,
      metadata: {
        email,
      },
    });

    // Email queue 
  await emailQueueService.sendVerificationEmail(
  email,
  verificationToken
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

export type AuthService = ReturnType<typeof createAuthService>;