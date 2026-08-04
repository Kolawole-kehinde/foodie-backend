export const RedisKeys = {
  otp: (email: string) => `otp:${email}`,
  loginAttempts: (email: string) => `login-attempts:${email}`,
  session: (id: string) => `session:${id}`,
  blacklist: (jti: string) => `blacklist:${jti}`,
};