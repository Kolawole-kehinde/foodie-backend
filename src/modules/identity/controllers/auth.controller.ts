import { asyncHandler } from "../../../shared/utils/async-handler.js";
import type { RegisterRequestDto } from "../dto/register-request.dto.js";
import type { AuthService } from "../services/auth.service.js";

type CreateAuthControllerDependencies = {
  authService: AuthService;
};

export const createAuthController = ({
  authService,
}: CreateAuthControllerDependencies) => {
  const register = asyncHandler(async (req, res) => {
    const dto: RegisterRequestDto = req.body;

    const ipAddress = req.ip;
    const userAgent = req.get("user-agent");

    const context = {
      ...(ipAddress !== undefined ? { ipAddress } : {}),
      ...(userAgent !== undefined ? { userAgent } : {}),
    };

    const result = await authService.register(dto, context);

    return res.status(201).json(result);
  });

  return {
    register,
  };
};

export type AuthController = ReturnType<typeof createAuthController>;