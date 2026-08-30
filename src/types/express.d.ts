import type { RoleName } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      id: string;

      user: {
        id: string;
        sessionId: string;
        roles: RoleName[];
      };

      context: {
        ipAddress?: string;
        userAgent?: string;
        deviceName?: string;
        latitude?: string;
        longitude?: string;
      };
    }
  }
}

export {};