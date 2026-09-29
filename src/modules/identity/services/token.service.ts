import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import { env } from "../../../config/env.js";

export type AccessTokenPayload = {
  userId: string;
  sessionId: string;
  roles: string[];
};

type JwtAccessTokenPayload = jwt.JwtPayload & {
  sub: string;
  sessionId: string;
  roles: string[];
};

export const createTokenService = () => {
  const generateRandomToken = (size = 32): string => {
    return crypto.randomBytes(size).toString("hex");
  };

  const generateOtp = (): string => {
    return crypto.randomInt(100000, 1000000).toString();
  };

  const hashToken = (token: string): string => {
    return crypto.createHash("sha256").update(token).digest("hex");
  };

  const createAccessToken = ({
    userId,
    sessionId,
    roles,
  }: AccessTokenPayload): string => {
    return jwt.sign(
      {
        sub: userId,
        sessionId,
        roles,
      },
      env.jwt.ACCESS_SECRET,
      {
        expiresIn: env.jwt.ACCESS_EXPIRES_IN as StringValue,
      },
    );
  };

  const verifyAccessToken = (token: string): AccessTokenPayload => {
    const decoded = jwt.verify(token, env.jwt.ACCESS_SECRET);

    if (typeof decoded !== "object" || decoded === null) {
      throw new Error("Invalid access token");
    }

    const payload = decoded as JwtAccessTokenPayload;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.sessionId !== "string" ||
      !Array.isArray(payload.roles) ||
      !payload.roles.every((role) => typeof role === "string")
    ) {
      throw new Error("Invalid access token payload");
    }

    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
      roles: payload.roles,
    };
  };

  return {
    generateRandomToken,
    hashToken,
    createAccessToken,
    verifyAccessToken,
    generateOtp,
  };
};

export type TokenService = ReturnType<typeof createTokenService>;
