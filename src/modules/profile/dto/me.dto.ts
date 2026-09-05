import type { UserStatus } from "@prisma/client";

export type MeDto = {
  id: string;
  email: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  roles: string[];
  createdAt: Date;
};