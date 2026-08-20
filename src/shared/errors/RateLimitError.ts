export class RateLimitError extends Error {
  statusCode = 429;
  code = "RATE_LIMIT_EXCEEDED";

  constructor(message = "Too many requests") {
    super(message);

    this.name = "RateLimitError";
  }
}