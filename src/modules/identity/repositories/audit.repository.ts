import type { DatabaseClient } from "../../../database/prisma/types.js";
import type { CreateAuditLogData } from "./types.js";

export const createAuditRepository = (db: DatabaseClient) => {
  const create = async (data: CreateAuditLogData) => {
    return db.auditLog.create({
      data,
    });
  };

  return {
    create,
  };
};

export type AuditRepository = ReturnType<
  typeof createAuditRepository
>;