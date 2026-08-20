export type RateLimitRule = {
  name: string;
  key: string;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  name: string;
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
};