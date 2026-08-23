import crypto from "node:crypto";

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

  return {
    generateRandomToken,
    hashToken,
  };
};

export type TokenService = ReturnType<typeof createTokenService>;