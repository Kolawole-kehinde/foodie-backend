import { LoginFailureReason } from "@prisma/client";
import type { LoginRequestDto } from "../dto/login-request.dto.js";

import type {AuthContext,AuthDependencies,} from "../types/auth.types.js";

import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import type { LoginResult } from "../dto/login-response.dto.js";

export const createLoginService = ({repositories,services,}: AuthDependencies) => {

  const login = async (dto: LoginRequestDto, context: AuthContext): Promise<LoginResult> => {


    const { email, password } = dto;


    // 1. Find user
      const user = await repositories.user.findByEmail(email);


    // 2. Check account lock
    if (user?.lockedUntil) {
    const now = new Date();

      // Account is currently locked
      if (user.lockedUntil > now) {
        await repositories.loginAttempt.create({
          userId: user.id,
          email,
          success: false,
          failureReason:
            LoginFailureReason.ACCOUNT_LOCKED,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        });

        throw new UnauthorizedError(
          "Invalid email or password"
        );
      }

      // Lock has expired
      await repositories.user.resetFailedLoginAttempts(
        user.id
      );
    }

  
    // 3. Select password hash
    const passwordHash = user?.passwordHash ?? services.password.getDummyHash();

    // 4. Always perform password verification
    const passwordValid =
      await services.password.verify(
        password,
        passwordHash
      );


    // 5. User doesn't exist
    if (!user) {
      await repositories.loginAttempt.create({
        email,
        success: false,
        failureReason:
          LoginFailureReason.USER_NOT_FOUND,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      throw new UnauthorizedError(
        "Invalid email or password"
      );
    }

  
    // 6. Invalid password
    if (!passwordValid) {
      const failedAttempt =
        await repositories.user.recordFailedLoginAttempt(
          user.id
        );

      await repositories.loginAttempt.create({
        userId: user.id,
        email,
        success: false,
        failureReason:
          LoginFailureReason.INVALID_PASSWORD,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });

      // The repository has already locked the account
      // if this was the 5th failed attempt.
      if (failedAttempt.locked) {
        // Security event/audit can be added here later.
      }

      throw new UnauthorizedError(
        "Invalid email or password"
      );
    }

    // 7. Successful authentication
    await repositories.user.resetFailedLoginAttempts(
      user.id
    );


    // 8. Update last login
     await repositories.user.update(user.id, {
      lastLoginAt: new Date(),
    });

    // 9. Record successful login
    await repositories.loginAttempt.create({
      userId: user.id,
      email,
      success: true,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

  
    // 10. Tokens come next
  

    throw new Error(
      "Token generation not implemented yet"
    );
  };

  return {
    login,
  };
};

export type LoginService = ReturnType<typeof createLoginService>;