import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "../../../config/env.js";
import type { RoleName } from "@prisma/client";

type AccessTokenPayload = {
  userId: string;
  sessionId: string;
  roles: RoleName[];
};

export const createTokenService = () => {
  const generateRandomToken = (size = 32): string => {
    return crypto.randomBytes(size).toString("hex");
  };

const generateJwtId = (): string => {
  return crypto.randomUUID();
};

  const hashToken = (token: string): string => {
    return crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
  };

  const createAccessToken = ({userId,sessionId,roles}: AccessTokenPayload) => {
    return jwt.sign({
        sub: userId,
        sessionId,
        roles
      },
      env.jwt.ACCESS_SECRET,
      {
        expiresIn: env.jwt.ACCESS_EXPIRES_IN as StringValue,
         jwtid: generateJwtId(),
      }
    );
  };

  return {
    generateRandomToken,
    hashToken,
    createAccessToken,
  };
};

export type TokenService = ReturnType<typeof createTokenService>;