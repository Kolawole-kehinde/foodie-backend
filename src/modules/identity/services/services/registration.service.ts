import { UserStatus } from "@prisma/client";
import type { AuthContext, AuthDependencies } from "../../types/auth.types.js";
import type { RegisterRequestDto } from "../../dto/register-request.dto.js";
import type { RegisterResponseDto } from "../../dto/register-response.dto.js";
import { ConflictError } from "../../../../shared/errors/ConflictError.js";
import { AUTH_EXPIRATION } from "../../constants/auth.constants.js";
import { AuditActions } from "../../constants/audit-action.constants.js";
import type { VerifyEmailRequestDto } from "../../dto/verify-email-request.dto.js";
import { createUserRepository } from "../../repositories/user.repository.js";
import { createPendingRegistrationRepository } from "../../repositories/pending-registration.repository.js";

export const createRegistrationService = ({ prisma, repositories, services, queues,}: AuthDependencies) => {
  const register = async (
    dto: RegisterRequestDto,
    context?: AuthContext
  ): Promise<RegisterResponseDto> => {
    const { email, password } = dto;

    // Check whether user already exists
    const existingUser = await repositories.user.findByEmail(email);
    if (existingUser) {
      throw new ConflictError("Email already exists");
    }

    //  2. Check whether registration is already pending
    const existingPendingRegistration =
      await repositories.pendingRegistration.findByEmail(email);

    if (existingPendingRegistration) {
      throw new ConflictError(
        "A registration for this email is already pending verification"
      );
    }

    //3. Hash password
    const passwordHash = await services.password.hash(password);

    // 4. Generate verification token
    const verificationToken = services.token.generateRandomToken();

    const verificationTokenHash = services.token.hashToken(verificationToken);

    // 5. Calculate expiration
    const now = Date.now();

    const verificationTokenExpiresAt = new Date(
      now + AUTH_EXPIRATION.VERIFICATION_TOKEN_MS
    );

    const expiresAt = new Date(
      now + AUTH_EXPIRATION.PENDING_REGISTRATION_MS
    );


    // 6. Create pending registration
    await repositories.pendingRegistration.create({
      email,
      passwordHash,
      verificationTokenHash,
      verificationTokenExpiresAt,
      expiresAt,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });


    // 7. Audit registration
    await services.audit.log({
      action: AuditActions.REGISTRATION_INITIATED,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
      metadata: {
        email,
      },
    });


    // 8. Send verification email
     await queues.email.sendVerificationEmail(
      email,
      verificationToken
    );

    // 9. Return response
    return {
      message:
        "Registration successful. Please verify your email.",
    };
  };

  const verifyEmail = async (
    dto: VerifyEmailRequestDto,
    context?: AuthContext
  ): Promise<{ message: string }> => {
    const { token } = dto;

    // --------------------------------------------------
    // 1. Hash incoming token
    // --------------------------------------------------

    const tokenHash = services.token.hashToken(token);

    // --------------------------------------------------
    // 2. Find pending registration
    // --------------------------------------------------

    const pendingRegistration =
      await repositories.pendingRegistration.findByTokenHash(
        tokenHash
      );

    if (!pendingRegistration) {
      throw new ConflictError(
        "Invalid or expired verification token"
      );
    }

    // --------------------------------------------------
    // 3. Check token expiration
    // --------------------------------------------------

    if (
      pendingRegistration.verificationTokenExpiresAt <=
      new Date()
    ) {
      throw new ConflictError(
        "Invalid or expired verification token"
      );
    }

    // --------------------------------------------------
    // 4. Convert pending registration into user
    // --------------------------------------------------

    const user = await prisma.$transaction(async (tx) => {
      const userRepositoryTx =
        createUserRepository(tx);

      const pendingRegistrationRepositoryTx =
        createPendingRegistrationRepository(tx);

      const createdUser =
        await userRepositoryTx.create({
          email: pendingRegistration.email,
          passwordHash:
            pendingRegistration.passwordHash,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        });

      await pendingRegistrationRepositoryTx.deleteById(
        pendingRegistration.id
      );

      return createdUser;
    });

    // --------------------------------------------------
    // 5. Audit successful verification
    // --------------------------------------------------

    await services.audit.log({
      action: AuditActions.EMAIL_VERIFIED,
      userId: user.id,
      ipAddress: context?.ipAddress,
      userAgent: context?.userAgent,
    });

    // --------------------------------------------------
    // 6. Return response
    // --------------------------------------------------

    return {
      message: "Email verified successfully.",
    };
  };

  return {
    register,
    verifyEmail,
  };
};

export type RegistrationService =
  ReturnType<typeof createRegistrationService>;