
import { createAxiosClient } from "../../../../infrastructure/axios/axios.client.js";
import type { PaymentProviderClient } from "../payment-provider.js";
import { createPaystackHttpHelper } from "../helpers/paystack-http.helper.js";
import { createInitializePaymentOperation } from "./operations/initialize-payment.operation.js";
import { createListRefundsOperation } from "./operations/list-refunds.operation.js";
import { createRefundPaymentOperation } from "./operations/refund-payment.operation.js";
import { createVerifyPaymentOperation } from "./operations/verify-payment.operation.js";
import { createVerifyRefundOperation } from "./operations/verify-refund.operation.js";
import { createVerifyWebhookOperation } from "./operations/verify-webhook.operation.js";

type PaystackProviderDependencies = {
  secretKey: string;
  baseUrl: string;
};

export const createPaystackProvider = ({
  secretKey,
  baseUrl,
}: PaystackProviderDependencies): PaymentProviderClient => {
  const client = createAxiosClient({
    baseUrl,
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
  });

  const http = createPaystackHttpHelper(client);

  return {
    initializePayment: createInitializePaymentOperation({ http }),
    verifyPayment: createVerifyPaymentOperation({ http }),
    refundPayment: createRefundPaymentOperation({ http }),
    listRefunds: createListRefundsOperation({ http }),
    verifyRefund: createVerifyRefundOperation({ http }),
    verifyWebhook: createVerifyWebhookOperation({ secretKey }),
  };
};
