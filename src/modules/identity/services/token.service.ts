import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { StringValue } from "ms";
import type { RoleName } from "@prisma/client";
import { env } from "../../../config/env.js";

export type AccessTokenPayload = {
  userId: string;
  sessionId: string;
  roles: RoleName[];
};

type JwtAccessTokenPayload = jwt.JwtPayload & {
  sub: string;
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
    return crypto.createHash("sha256").update(token).digest("hex");
  };

  // Create access token
  const createAccessToken = ({userId, sessionId, roles,}: AccessTokenPayload) => {
    return jwt.sign({
        sub: userId,
        sessionId,
        roles,
      },
      env.jwt.ACCESS_SECRET,
      {
        expiresIn: env.jwt.ACCESS_EXPIRES_IN as StringValue,
        jwtid: generateJwtId(),
      },
    );
  };

  // Verify and decode access token
  const verifyAccessToken = (token: string): AccessTokenPayload => {
    const decoded = jwt.verify(token, env.jwt.ACCESS_SECRET);

    if (typeof decoded !== "object" || decoded === null) {
      throw new Error("Invalid access token");
    }

    const payload = decoded as JwtAccessTokenPayload;

    if (
      typeof payload.sub !== "string" ||
      typeof payload.sessionId !== "string" ||
      !Array.isArray(payload.roles)
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
  };
};

export type TokenService = ReturnType<typeof createTokenService>;
