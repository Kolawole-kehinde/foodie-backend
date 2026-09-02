import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import { asyncHandler } from "../../../shared/utils/async-handler.js";
import {REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE_OPTIONS,} from "../constants/auth-cookie.js";
import type { LoginRequestDto } from "../dto/login-dto.js";
import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { VerifyEmailRequestDto } from "../dto/verify-email-request.dto.js";
import type { AuthService } from "../services/auth.service.js";
import type { RequestHandler } from "express";


type AuthController = {
  register: RequestHandler;
  verifyEmail: RequestHandler;
  login: RequestHandler;
  refresh: RequestHandler;
  logout: RequestHandler;
  logoutAllDevices: RequestHandler;
  getSessions: RequestHandler;
  revokeSession: RequestHandler;
};

type CreateAuthControllerDependencies = {
  authService: AuthService;
};

export const createAuthController = ({
  authService,
}: CreateAuthControllerDependencies): AuthController => {
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

  const logout = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies[REFRESH_TOKEN_COOKIE];

    if (refreshToken) {
      await authService.logout(refreshToken, {
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
    }

    res.clearCookie(
      REFRESH_TOKEN_COOKIE,
      REFRESH_TOKEN_COOKIE_OPTIONS
    );

    return res.status(200).json({
      message: "Logged out successfully",
    });
  });




  // The authentication middleware should attach the authenticated
  // user's ID to the request.

  const logoutAllDevices = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  const result = await authService.logoutAllDevices(userId);

  // Clear the refresh-token cookie on the current browser/device.
  res.clearCookie(
    REFRESH_TOKEN_COOKIE,
    REFRESH_TOKEN_COOKIE_OPTIONS
  );

  return res.status(200).json({
    message: "Logged out from all devices successfully",
    ...result,
  });
});


const getSessions = asyncHandler (async(req, res) => {
    const userId = req.user.id
    const currentSessionId = req.user.sessionId;

    const result = await authService.getActiveSessions(
      userId,
      currentSessionId
    );

  return res.status(200).json(result);
});

const revokeSession = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const sessionId = req.params.sessionId;

  if (typeof sessionId !== "string" || !sessionId) {
    throw new BadRequestError("Session ID is required");
  }

  const result = await authService.revokeSession(
    userId,
    sessionId,
  );

  return res.status(200).json(result);
});



  return {
    register,
    verifyEmail,
    login,
    refresh,
    logout,
    logoutAllDevices,
    getSessions,
    revokeSession
  };
};


