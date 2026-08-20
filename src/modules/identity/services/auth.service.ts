import {
  UserStatus,
  type PrismaClient,
} from "@prisma/client";

import {
  createPendingRegistrationRepository,
  type PendingRegistrationRepository,
} from "../repositories/pending-registration.repository.js";

import { createUserRepository, type UserRepository } from "../repositories/user.repository.js";

import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";
import type { AuditService } from "./audit.service.js";

import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { AuditActions } from "../constants/audit-action.constants.js";

import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { RegisterResponseDto } from "../dto/register-response.dto.js";
import type { VerifyEmailRequestDto } from "../dto/verify-email-request.dto.js";

type CreateAuthServiceDependencies = {
  prisma: PrismaClient;
  userRepository: UserRepository;
  pendingRegistrationRepository: PendingRegistrationRepository;
  passwordService: PasswordService;
  tokenService: TokenService;
  auditService: AuditService;
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
}: CreateAuthServiceDependencies) => {
  const register = async (
    dto: RegisterRequestDto,
    context?: RegisterContext
  ): Promise<RegisterResponseDto> => {
    const { email, password } = dto;

    const existingUser =
      await userRepository.findByEmail(email);

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

    const passwordHash =
      await passwordService.hash(password);

    const verificationToken =
      tokenService.generateRandomToken();

    const verificationTokenHash =
      tokenService.hashToken(verificationToken);

    const verificationTokenExpiresAt = new Date(
      Date.now() + 1000 * 60 * 30
    );

    await prisma.$transaction(async (tx) => {
      const pendingRegistrationRepositoryTx =
        createPendingRegistrationRepository(tx);

      await pendingRegistrationRepositoryTx.create({
        email,
        passwordHash,
        verificationTokenHash,
        verificationTokenExpiresAt,
        ipAddress: context?.ipAddress,
        userAgent: context?.userAgent,
      });
    });

    await auditService.log({
      action: AuditActions.REGISTRATION_INITIATED,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        email,
      },
    });

    // Email queue will be added here.

    return {
      message:
        "Registration successful. Please verify your email.",
    };
  };


  const verifyEmail = async ( dto: VerifyEmailRequestDto, context?: RegisterContext): Promise<{ message: string }> => {
    const { token } = dto;

    // Hash the raw token.
    const tokenHash = tokenService.hashToken(token);

    // Find the pending registration.
    const pendingRegistration = await pendingRegistrationRepository.findByTokenHash(
        tokenHash
      );

    if (!pendingRegistration) {
      throw new ConflictError(
        "Invalid or expired verification token"
      );
    }

    // Check expiration.
    if (pendingRegistration.verificationTokenExpiresAt <=new Date()) {
      throw new ConflictError(
        "Invalid or expired verification token"
      );
    }

    // Convert PendingRegistration -> User atomically.
    const user = await prisma.$transaction(async (tx) => {
        const userRepositoryTx =createUserRepository(tx);

        const pendingRegistrationRepositoryTx = createPendingRegistrationRepository(tx);

        const createdUser = await userRepositoryTx.create({
            email: pendingRegistration.email,
            passwordHash: pendingRegistration.passwordHash,
            status: UserStatus.ACTIVE,
            emailVerifiedAt: new Date(),
          });

        await pendingRegistrationRepositoryTx.deleteById(
          pendingRegistration.id
        );

        return createdUser;
      }
    );

    // Record successful verification.
    await auditService.log({
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
    register,
    verifyEmail,
  };
};

export type AuthService = ReturnType<typeof createAuthService>;