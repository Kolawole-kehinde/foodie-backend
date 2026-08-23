import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env.js";


type AccessTokenPayload = {
  userId: string;
  sessionId: string;
};


export const createTokenService = () => {

  const generateRandomToken = (size = 32): string => {
    return crypto.randomBytes(size).toString("hex");
  };

  const hashToken = (token: string): string => {
    return crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
  };

  const add = ({userId, sessionId}: AccessTokenPayload) =>{
    return jwt.sign({
      userId,
      sessionId,
    },
    env.jwt.ACCESS_SECRET,
    {
      expiresIn: env.jwt.ACCESS_EXPIRES_IN as any
    }
  )
}

  return {
    generateRandomToken,
    hashToken,
    createAccessToken
  };
};

export type TokenService = ReturnType<typeof createTokenService>;