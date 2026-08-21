export const AUTH_EXPIRATION = {
  VERIFICATION_TOKEN_MS: 1000 * 60 * 30, // 30 minutes
  PENDING_REGISTRATION_MS: 1000 * 60 * 60 * 2, // 2 hours
} as const;