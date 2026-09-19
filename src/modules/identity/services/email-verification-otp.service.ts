import type { RedisClient } from "../../../database/redis/client.js";
import type { TokenService } from "./token.service.js";

type EmailVerificationOtpServiceDependencies = {
  redis: RedisClient;
  tokenService: TokenService;
};

type EmailVerificationOtpRecord = {
  otpHash: string;
  attempts: number;
};

const OTP_TTL_SECONDS = 10 * 60;
const MAX_OTP_ATTEMPTS = 5;

const getOtpKey = (email: string): string => {
  return `auth:email-verification:otp:${email}`;
};

/**
 * Redis Lua script for atomic OTP verification.
 *
 * Return codes:
 * 0 → OTP not found / expired
 * 1 → OTP verified successfully
 * 2 → Invalid OTP
 * 3 → Maximum attempts reached
 *
 * The entire read → verify → update/delete operation
 * executes atomically inside Redis.
 */
const VERIFY_OTP_SCRIPT = `
local key = KEYS[1]
local suppliedHash = ARGV[1]
local maxAttempts = tonumber(ARGV[2])

local data = redis.call("GET", key)

if not data then
  return 0
end

local record = cjson.decode(data)

if record.attempts >= maxAttempts then
  redis.call("DEL", key)
  return 3
end

if record.otpHash == suppliedHash then
  redis.call("DEL", key)
  return 1
end

record.attempts = record.attempts + 1

if record.attempts >= maxAttempts then
  redis.call("DEL", key)
else
  local ttl = redis.call("TTL", key)

  if ttl > 0 then
    redis.call("SET", key, cjson.encode(record), "EX", ttl)
  end
end

return 2
`;

export const createEmailVerificationOtpService = ({
  redis,
  tokenService,
}: EmailVerificationOtpServiceDependencies) => {
  // Generate a new OTP and store its hash in Redis.
  const generate = async (email: string): Promise<string> => {
    const otp = tokenService.generateOtp();
    const otpHash = tokenService.hashToken(otp);

    const record: EmailVerificationOtpRecord = {
      otpHash,
      attempts: 0,
    };

    await redis.set(
      getOtpKey(email),
      JSON.stringify(record),
      "EX",
      OTP_TTL_SECONDS,
    );

    return otp;
  };

  // Verify an OTP atomically inside Redis.
  const verify = async (
    email: string,
    otp: string,
  ): Promise<boolean> => {
    const key = getOtpKey(email);
    const otpHash = tokenService.hashToken(otp);

    const result = await redis.eval(
      VERIFY_OTP_SCRIPT,
      1,
      key,
      otpHash,
      MAX_OTP_ATTEMPTS,
    );

    switch (result) {
      case 1:
        return true;

      case 0:
      case 2:
      case 3:
        return false;

      default:
        throw new Error("Unexpected OTP verification result");
    }
  };

  // Invalidate an existing OTP.
  const invalidate = async (email: string): Promise<void> => {
    await redis.del(getOtpKey(email));
  };

  return {
    generate,
    verify,
    invalidate,
  };
};

export type EmailVerificationOtpService = ReturnType<
  typeof createEmailVerificationOtpService
>;