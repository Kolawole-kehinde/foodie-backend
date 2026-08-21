import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { VerifyEmailRequestDto } from "../dto/verify-email-request.dto.js";
import type { AuthService } from "../services/auth.service.js";

type CreateAuthControllerDependencies = {
  authService: AuthService;
};

export const createAuthController = ({authService,}: CreateAuthControllerDependencies) => {
  
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

  return {
    register,
    verifyEmail,
  };
};

export type AuthController =  ReturnType<typeof createAuthController>;