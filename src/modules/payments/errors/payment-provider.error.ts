export type PaymentProviderErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "SERVER_ERROR"
  | "INVALID_RESPONSE"
  | "UNKNOWN";

export type PaymentProviderErrorOptions = {
  provider: string;
  code: PaymentProviderErrorCode;

  message: string;

  retryable: boolean;

  // True when the provider may have received and processed the request, but we don't know the result.
   /* Example:
   * - request timeout
   * - connection reset after request was sent
   */
  uncertain: boolean;

  statusCode?: number;

  providerCode?: string;

  cause?: unknown;
};

export class PaymentProviderError extends Error {
  readonly provider: string;
  readonly code: PaymentProviderErrorCode;
  readonly retryable: boolean;
  readonly uncertain: boolean;
  readonly statusCode?: number;
  readonly providerCode?: string;

  constructor({
    provider,
    code,
    message,
    retryable,
    uncertain,
    statusCode,
    providerCode,
    cause,
  }: PaymentProviderErrorOptions) {
    super(message, { cause });

    this.name = "PaymentProviderError";

    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
    this.uncertain = uncertain;
    this.statusCode = statusCode;
    this.providerCode = providerCode;
  }
}