import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";


export const createInboxRepository = (db: DatabaseClient) => {
  const findByEventId = async (eventId: string) => {
    return db.inboxEvent.findUnique({
      where: {
        eventId,
      },
    });
  };

  const create = async (data: Prisma.InboxEventCreateInput) => {
    return db.inboxEvent.create({
      data,
    });
  };

  const updateStatus = async ( eventId: string, data: Prisma.InboxEventUpdateInput) => {
    return db.inboxEvent.update({
      where: {
        eventId,
      },
      data,
    });
  };

  return {
    findByEventId,
    create,
    updateStatus,
  };
};