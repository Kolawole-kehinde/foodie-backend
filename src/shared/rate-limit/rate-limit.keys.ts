

import { createHash } from "node:crypto";

const hash = (value: string): string => {
  return createHash("sha256")
    .update(value)
    .digest("hex");
};

export const rateLimitKeys = {
  email: (email: string) =>
    `rate-limit:register:email:${hash(
      email.trim().toLowerCase()
    )}`,

  ip: (ip: string) =>
    `rate-limit:register:ip:${hash(ip)}`,
};