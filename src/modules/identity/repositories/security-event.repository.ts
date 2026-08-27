import type {
  Prisma,
  SecurityEventSeverity,
  SecurityEventType,
} from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

type CreateSecurityEventData = {
  userId?: string;
  type: SecurityEventType;
  severity?: SecurityEventSeverity;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  metadata?: Prisma.InputJsonValue;
};

export const createSecurityEventRepository = (db: DatabaseClient) => {
  const create = async (data: CreateSecurityEventData) => {
    return db.securityEvent.create({
      data: {
        userId: data.userId,
        type: data.type,
        severity: data.severity,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        country: data.country,
        city: data.city,
        metadata: data.metadata,
      },
    });
  };

  return {
    create,
  };
};

export type SecurityEventRepository = ReturnType<
  typeof createSecurityEventRepository
>;
