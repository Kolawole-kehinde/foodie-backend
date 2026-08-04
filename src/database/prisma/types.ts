import type { Prisma, PrismaClient } from "@prisma/client/extension";


export type DatabaseClient =
  | PrismaClient
  | Prisma.TransactionClient;