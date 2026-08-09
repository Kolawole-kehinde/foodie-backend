import { UserStatus, type PrismaClient } from "@prisma/client";
import {createUserRepository,type UserRepository,} from "../repositories/user.repository.js";
import { createEmailVerificationTokenRepository } from "../repositories/email-verification-token.repository.js";
import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";
import type { AuditService } from "./audit.service.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { AuditActions } from "../constants/audit-action.constants.js";
import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { RegisterResponseDto } from "../dto/register-response.dto.js";



type CreateAuthServiceDependencies = {
  prisma: PrismaClient;
  userRepository: UserRepository;
  passwordService: PasswordService;
  tokenService: TokenService;
  auditService: AuditService;
};

export const createAuthService = ({
   prisma,
  userRepository,
  passwordService,
  tokenService,
  auditService,
}: CreateAuthServiceDependencies) => {


  const register = async (dto: RegisterRequestDto,): Promise<RegisterResponseDto> => {

    const { email, password } = dto;

    const existingUser = await userRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictError("Email already exists");
    }

    const passwordHash = await passwordService.hash(password);

    const verificationToken = tokenService.generateRandomToken();

    const tokenHash = tokenService.hashToken(verificationToken);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

    const user = await prisma.$transaction(async (tx) => {
      const userRepositoryTx = createUserRepository(tx);

      const verificationRepositoryTx = createEmailVerificationTokenRepository(tx);

      const user = await userRepositoryTx.create({
        email,
        passwordHash,
        status: UserStatus.PENDING_VERIFICATION,
      });

      await verificationRepositoryTx.create({
        tokenHash,
        expiresAt,
        user: {
          connect: {
            id: user.id,
          },
        },
      });

      return user;
    });

    await auditService.log({
      action: AuditActions.REGISTRATION_INITIATED,
      userId: user.id,
    });

    // Email queue will be added next.

    return {
      message: "Registration successful. Please verify your email.",
    };
  };

  return {
    register,
  };
};

export type AuthService = ReturnType<typeof createAuthService>;
