import bcrypt from "bcrypt";
import type { IPasswordService } from "../interfaces/password-service.interface.js";
import { env } from "../../../config/env.js";



export class PasswordService implements IPasswordService {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, env.auth.BCRYPT);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }
}