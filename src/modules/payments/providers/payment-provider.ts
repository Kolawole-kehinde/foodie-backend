import type { PaymentProvider } from "@prisma/client";

// Payment Provider Interface


//  Normalized payment status returned by a payment provider.
 // Our application should work with one consistent set of statuses.
export type ProviderPaymentStatus =
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

// Data required to initialize a payment with a provider.
 // The provider adapter receives this information and translates it into whatever request format that specific provider requires.
export type InitializePaymentInput = {
  paymentId: string;
  attemptId: string;
  amount: string;
  currency: string;
  customerEmail: string;

  // Optional URL the provider can redirect the customer to after completing the payment.
  callbackUrl?: string;

  // Optional provider-independent metadata.
   // Useful when a provider needs additional context without putting provider-specific fields into the common interface.
  metadata?: Record<string, string>;
};

// Normalized result returned after payment initialization.
 // The rest of the application does not need to know what Paystack or Flutterwave called these fields.
export type InitializePaymentResult = {
  provider: PaymentProvider;
  providerReference: string;

  // URL where the customer should be redirected to complete payment.
  authorizationUrl?: string;
  status: ProviderPaymentStatus;

  // Optional provider-specific information. Keep this out of the core payment logic.
  metadata?: Record<string, unknown>;
};

// Data required to verify an existing provider payment.
export type VerifyPaymentInput = {
  providerReference: string;
};

// Normalized result returned by the provider after verification.
export type VerifyPaymentResult = {
  provider: PaymentProvider;
  providerReference: string;
  status: ProviderPaymentStatus;
  amount: string;
  currency: string;

  // Optional reason supplied by the provider when  verification indicates a failure.
  failureReason?: string;
};

// Data required to request a refund from a provider.
export type RefundPaymentInput = {
  providerReference: string;
  amount: string;
  currency: string;
  reason?: string;
};

// Normalized refund result.
export type RefundPaymentResult = {
  provider: PaymentProvider;
  providerReference: string;
  refundReference: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "CANCELLED";
  amount: string;
  currency: string;
  failureReason?: string;
};

// Data required to verify a webhook.
 // The raw body is important because many providers calculate their signature from the exact raw request body.
export type VerifyWebhookInput = {
  rawBody: string;
  signature: string;
};

// Normalized webhook result.
 // The provider adapter verifies the provider-specific signature  and converts the provider payload into this common structure.

export type VerifyWebhookResult = {
  eventId: string;
  eventType: string;
  providerReference?: string;
  status: ProviderPaymentStatus;
  amount?: string;
  currency?: string;

  // Keep the original verified payload so the webhook service can persist it for auditing/reconciliation if necessary.
  payload: Record<string, unknown>;
};

// Payment Provider Interface
// Every payment provider must implement this contract.
// PaymentService and PaymentProcessingService will depend on this interface instead of depending directly on Paystack,Flutterwave, or another provider.

export interface PaymentProviderClient {
  //Start a new payment with the external provider.
  initializePayment(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult>;

  // Ask the provider for the current state of a payment.
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;

  //Request a refund from the provider.
  refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult>;

  // Verify and normalize a provider webhook.
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifyWebhookResult>;
}
