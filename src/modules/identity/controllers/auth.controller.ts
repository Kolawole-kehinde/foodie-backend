
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import { REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_OPTIONS } from "../constants/auth-cookie.js";
import type { LoginRequestDto } from "../dto/login-dto.js";
import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { VerifyEmailRequestDto } from "../dto/verify-email-request.dto.js";
import type { AuthService } from "../services/auth.service.js";

type CreateAuthControllerDependencies = {
  authService: AuthService;
};

export const createAuthController = ({
  authService,
}: CreateAuthControllerDependencies) => {
  const register = asyncHandler(async (req, res) => {
    const dto: RegisterRequestDto = req.body;

    const result = await authService.register(dto, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(201).json(result);
  });



  const verifyEmail = asyncHandler(async (req, res) => {
    const dto: VerifyEmailRequestDto = req.body;

    const result = await authService.verifyEmail(dto, {
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.status(200).json(result);
  });




 const login = asyncHandler(async (req, res) => {
  const dto: LoginRequestDto = req.body;

  const result = await authService.login(dto, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.cookie(
    REFRESH_TOKEN_COOKIE,
    result.refreshToken,
    REFRESH_TOKEN_COOKIE_OPTIONS,
  );

  return res.status(200).json({
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    user: result.user,
  });
});



  const refresh = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];

  if (!refreshToken) {
    throw new UnauthorizedError("Invalid refresh token");
  }

  const result = await authService.refresh(refreshToken, {
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });

  res.cookie(
    REFRESH_TOKEN_COOKIE,
    result.refreshToken,
    REFRESH_TOKEN_COOKIE_OPTIONS,
  );

  return res.status(200).json({
    accessToken: result.accessToken,
    expiresIn: result.expiresIn,
    user: result.user,
  });
});
  return {
    register,
    verifyEmail,
    login,
    refresh,
  };
};

export type AuthController = ReturnType<typeof createAuthController>;
