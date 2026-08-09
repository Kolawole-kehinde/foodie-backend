
import type { Prisma } from "@prisma/client";
import type { AuditAction } from "../constants/audit-action.constants.js";
import type { AuditRepository } from "../repositories/audit.repository.js";

type AuditLogInput = {
  action: AuditAction;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};


export const createAuditService = (
  auditRepository: AuditRepository
) => {
  const log = async ({
    action,
    userId,
    ipAddress,
    userAgent,
    metadata,
  }: AuditLogInput) => {
    return auditRepository.create({
      action,

      ...(userId && {
        user: {
          connect: {
            id: userId,
          },
        },
      }),

      ...(ipAddress !== undefined && { ipAddress }),

      ...(userAgent !== undefined && { userAgent }),

      ...(metadata !== undefined && { metadata }),
    });
  };

  return {
    log,
  };
};

export type AuditService = ReturnType<typeof createAuditService>;

