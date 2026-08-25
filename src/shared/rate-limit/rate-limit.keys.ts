import { createHash } from "node:crypto";

const hash = (value: string): string => {
  return createHash("sha256")
    .update(value)
    .digest("hex");
};

export const rateLimitKeys = {email: (scope: string, email: string) =>
    `rate-limit:${scope}:email:${hash(
      email.trim().toLowerCase()
    )}`,

  ip: (scope: string, ip: string) =>
    `rate-limit:${scope}:ip:${hash(ip)}`,
};