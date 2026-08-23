import bcrypt from "bcrypt";
import { env } from "../../../config/env.js";

export const createPasswordService = () => {
  const hash = async (password: string): Promise<string> => {
    return bcrypt.hash(password, env.auth.BCRYPT);
  };

  const verify = async (
    password: string,
    hash: string
  ): Promise<boolean> => {
    return bcrypt.compare(password, hash);
  };
  const DUMMY_PASSWORD_HASH = "$2b$12$LQv3c1yqBW9s5QnZ7JQZ4u5H1W8QY5H5L6YQ5vV6FQ8J6L5Q9YQ6";

  return {
    hash,
    verify,
    DUMMY_PASSWORD_HASH
  };
};

export type PasswordService = ReturnType<typeof createPasswordService>;
