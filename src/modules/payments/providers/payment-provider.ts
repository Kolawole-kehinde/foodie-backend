import type {
  InitializePaymentInput,
  InitializePaymentResult,
  RefundPaymentInput,
  RefundPaymentResult,
  VerifyPaymentInput,
  VerifyPaymentResult,
  VerifyRefundInput,
  VerifyRefundResult,
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

    verifyRefund(
  input: VerifyRefundInput,
): Promise<VerifyRefundResult>;

  verifyWebhook(
    input: VerifyWebhookInput,
  ): Promise<VerifyWebhookResult>;

  refundPayment(
    input: RefundPaymentInput,
  ): Promise<RefundPaymentResult>;


}