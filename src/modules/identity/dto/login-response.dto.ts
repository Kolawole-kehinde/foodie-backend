import type { RoleName } from "@prisma/client";

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