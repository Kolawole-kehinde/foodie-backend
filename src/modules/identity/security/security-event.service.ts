import type {
  PrismaClient,
  SecurityEventSeverity,
  SecurityEventType,
} from "@prisma/client";

type CreateSecurityEventInput = {
  userId?: string;
  type: SecurityEventType;
  severity?: SecurityEventSeverity;
  ipAddress?: string;
  userAgent?: string;
  country?: string;
  city?: string;
  metadata?: unknown;
};

export const createSecurityEventService = (prisma: PrismaClient) => {
  const record = async (data: CreateSecurityEventInput) => {
    return prisma.securityEvent.create({
      data: {
        userId: data.userId,
        type: data.type,
        severity: data.severity,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        country: data.country,
        city: data.city,
        // metadata: data.metadata,
      },
    });
  };

  return {
    record,
  };
};

export type SecurityEventService = ReturnType<typeof createSecurityEventService>;
