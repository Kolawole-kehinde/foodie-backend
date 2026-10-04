import type {
  InitializePaymentInput,
  InitializePaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  VerifyWebhookInput,
  VerifyWebhookResult,
} from "../types/payment.types.js";

export interface PaymentProviderClient {
  initializePayment(
    input: InitializePaymentInput,
  ): Promise<InitializePaymentResult>;

  verifyPayment(
    input: VerifyPaymentInput,
  ): Promise<VerifyPaymentResult>;

  verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifyWebhookResult>;

  refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult>;
}