export const USER_ROLES = [
  "admin",
  "user",
  "customer_support",
] as const;

export type UserRole = (typeof USER_ROLES)[number];