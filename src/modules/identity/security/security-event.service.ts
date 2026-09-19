import type {
  Prisma,
  SecurityEventSeverity,
  SecurityEventType,
} from "@prisma/client";

import type { SecurityEventRepository } from "../repositories/security-event.repository.js";

type CreateSecurityEventInput = {
  userId?: string;
  type: SecurityEventType;
  severity?: SecurityEventSeverity;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  metadata?: Prisma.InputJsonValue;
};

export const createSecurityEventService = (
  repository: SecurityEventRepository,
) => {
  const record = async (data: CreateSecurityEventInput) => {
    return repository.create(data);
  };

  return {
    record,
  };
};

export type SecurityEventService = ReturnType<
  typeof createSecurityEventService
>;