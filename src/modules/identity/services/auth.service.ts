import { UserStatus, type PrismaClient } from "@prisma/client";
import { createUserRepository, type UserRepository } from "../repositories/user.repository.js";
import { createEmailVerificationTokenRepository, type EmailVerificationTokenRepository } from "../repositories/email-verification-token.repository.js";
import type { PasswordService } from "./password.service.js";
import type { TokenService } from "./token.service.js";
import type { AuditService } from "./audit.service.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { AuditActions } from "../constants/audit-action.constants.js";


type CreateAuthServiceDependencies = {
  prisma: PrismaClient;

  userRepository: UserRepository;

  emailVerificationTokenRepository: EmailVerificationTokenRepository;

  passwordService: PasswordService;

  tokenService: TokenService;

  auditService: AuditService;
};

type RegisterInput = {
  email: string;
  password: string;
};




export const createAuthService = (
  dependencies: CreateAuthServiceDependencies
) => {
  const {
    prisma,
    userRepository,
    passwordService,
    tokenService,
    auditService,
  } = dependencies;

const register = async ({ email, password,}: RegisterInput) => {

  const existingUser = await userRepository.findByEmail(email);

  if (existingUser) {
    throw new ConflictError("Email already exists");
  }

  const passwordHash =  await passwordService.hash(password);

  const verificationToken = tokenService.generateRandomToken();

  const tokenHash = tokenService.hashToken(verificationToken);

  const expiresAt = new Date(
    Date.now() + 1000 * 60 * 30
  );

  await prisma.$transaction(async (tx) => {
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

    await auditService.log({
      action: AuditActions.REGISTRATION_INITIATED,
      userId: user.id,
    });
  });

  return {
    message:
      "Registration successful. Please verify your email.",
  };
};
};

export type AuthService = ReturnType<typeof createAuthService>;