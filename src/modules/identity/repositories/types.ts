import { Prisma } from "@prisma/client";

export type CreateUserData = Prisma.UserCreateInput;
export type UpdateUserData = Prisma.UserUpdateInput;

export type CreateEmailVerificationTokenData =  Prisma.EmailVerificationTokenCreateInput;

export type UpdateEmailVerificationTokenData = Prisma.EmailVerificationTokenUpdateInput;

export type CreateAuditLogData = Prisma.AuditLogCreateInput;