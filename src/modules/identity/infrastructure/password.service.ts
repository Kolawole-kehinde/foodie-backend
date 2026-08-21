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

  return {
    hash,
    verify,
  };
};

export type PasswordService = ReturnType<typeof createPasswordService>;
