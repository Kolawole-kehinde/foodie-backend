import type { DatabaseClient } from "../../../database/prisma/types.js";
import { AUTH_SECURITY } from "../constants/auth.constants.js";
import type {
  CreateUserData,
  UpdateUserData,
} from "./types.js";

export const createUserRepository = (
  db: DatabaseClient
) => {
  const create = async (data: CreateUserData) => {
    return db.user.create({
      data,
    });
  };

const userWithRoles = {
  roles: {
    include: {
      role: true,
    },
  },
};

const findById = async (id: string) => {
  return db.user.findUnique({
    where: { id },
    include: userWithRoles,
  });
};

const findByEmail = async (email: string) => {
  return db.user.findUnique({
    where: { email },
    include: userWithRoles,
  });
};

  /**
   * Atomically increments failed login attempts.
   *
   * Once the maximum number of attempts is reached,
   * the account is locked for the configured duration.
   *
   * The existing lock is not extended by subsequent
   * failed attempts while the account is already locked.
   */
  const recordFailedLoginAttempt = async (id: string) => {
  const maxAttempts =
    AUTH_SECURITY.MAX_FAILED_LOGIN_ATTEMPTS;

  const lockDurationMs =
    AUTH_SECURITY.LOGIN_LOCKOUT_MS;

  const result = await db.$queryRaw<
    {
      failedLoginAttempts: number;
      lockedUntil: Date | null;
    }[]
  >`
    UPDATE "User"
    SET
      "failedLoginAttempts" =
        "failedLoginAttempts" + 1,

      "lockedUntil" =
        CASE
          WHEN
            "lockedUntil" IS NULL
            AND
            "failedLoginAttempts" + 1 >= ${maxAttempts}
          THEN
            NOW() +
            (${lockDurationMs} * INTERVAL '1 millisecond')

          ELSE "lockedUntil"
        END

    WHERE "id" = ${id}

    RETURNING
      "failedLoginAttempts",
      "lockedUntil";
  `;

  const user = result[0];

  if (!user) {
    throw new Error("User not found");
  }

  return user;
};

  const resetFailedLoginAttempts = async (
    id: string
  ) => {
    return db.user.update({
      where: { id },

      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  };

  const update = async (
    id: string,
    data: UpdateUserData
  ) => {
    return db.user.update({
      where: { id },
      data,
    });
  };

  return {
    create,
    findById,
    findByEmail,
    recordFailedLoginAttempt,
    resetFailedLoginAttempts,
    update,
  };
};

export type UserRepository = ReturnType<typeof createUserRepository>;