import type { RoleName } from "@prisma/client";


export type UserResponseDto = {
  id: string;
  email: string;
  status: string;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  roles: { 
    id: string; 
    name: RoleName; 
    description: string | null
 }[];
};
