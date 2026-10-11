
// Gives the worker a reliable way to decide whether an email failure
// should be retried or treated as permanent.
export class EmailProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly providerCode?: string,
    public readonly responseCode?: number,
  ) {
    super(message);
    this.name = "EmailProviderError";
  }
}