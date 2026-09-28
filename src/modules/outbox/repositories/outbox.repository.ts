import type { Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";

export const createOutboxRepository = (db: DatabaseClient) => {
  const create = async (data: Prisma.OutboxEventCreateInput) => {
    return db.outboxEvent.create({
      data,
    });
  };

  const findPendingEvents = async (limit: number, now: Date) => {
    return db.outboxEvent.findMany({
      where: {
        status: "PENDING",
        availableAt: {
          lte: now,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit,
    });
  };

  const findById = async (id: string) => {
    return db.outboxEvent.findUnique({
      where: { id },
    });
  };

  const markProcessing = async (id: string) => {
    return db.outboxEvent.update({
      where: { id },
      data: {
        status: "PROCESSING",
        attempts: {
          increment: 1,
        },
      },
    });
  };

  const markPublished = async (id: string, publishedAt: Date) => {
    return db.outboxEvent.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt,
        lastError: null,
      },
    });
  };

  const markFailed = async (
    id: string,
    availableAt: Date,
    lastError: string,
  ) => {
    return db.outboxEvent.update({
      where: { id },
      data: {
        status: "FAILED",
        availableAt,
        lastError,
      },
    });
  };

  const markDeadLetter = async (id: string, lastError: string) => {
    return db.outboxEvent.update({
      where: { id },
      data: {
        status: "DEAD_LETTER",
        lastError,
      },
    });
  };

  return {
    create,
    findPendingEvents,
    findById,
    markProcessing,
    markPublished,
    markFailed,
    markDeadLetter,
  };
};

export type OutboxRepository = ReturnType<typeof createOutboxRepository>;
