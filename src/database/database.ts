import type { DatabaseClient } from "./prisma/types.js";

export type Database = {transaction<T>(
    callback: (tx: DatabaseClient) => Promise<T>
  ): Promise<T>;
};