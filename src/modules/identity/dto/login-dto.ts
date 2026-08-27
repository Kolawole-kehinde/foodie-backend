import type { RoleName } from "@prisma/client";
import type z from "zod";
import type { loginSchema } from "../validators/login.validator.js";

export type LoginResponseDto = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;

  user: {
    id: string;
    email: string;
    roles: RoleName[];
  };
};

export type LoginRequestDto = z.infer<typeof loginSchema>;