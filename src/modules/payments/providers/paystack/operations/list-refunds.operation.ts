
import { PaymentProvider } from "@prisma/client";
import type { ListRefundsResult,} from "../../../types/payment.types.js";
import { createPaystackHttpHelper } from "../../helpers/paystack-http.helper.js";
import { assertPaystackResponse } from "../../helpers/paystack-response.helper.js";
import { fromSubunit, getRefundProviderReference, mapRefundStatus, normalizeCurrency,} from "../paystack-mappers.js";
import type { PaystackRefundListResponse, PaystackVerifyResponse,} from "../paystack.types.js";

type PaystackHttp = ReturnType<typeof createPaystackHttpHelper>;

type ListRefundsOperationDependencies = {
  http: PaystackHttp;
};

export const createListRefundsOperation = ({ http}: ListRefundsOperationDependencies) => {

  const listRefunds = async ( transactionReference: string): Promise<ListRefundsResult> => {
    // Resolve the provider reference to Paystack's transaction ID.
    const transactionResponse = await http.request<PaystackVerifyResponse>({
        method: "GET",
        url: `/transaction/verify/${encodeURIComponent(
          transactionReference,
        )}`,
      });

    const transactionData = assertPaystackResponse(
      transactionResponse.data,
      "transaction verification",
    );

    const transactionId = transactionData.id;

    if (
      typeof transactionId !== "number" ||
      !Number.isSafeInteger(transactionId) ||
      transactionId <= 0
    ) {
      throw new Error("Paystack transaction ID is missing or invalid");
    }

    // Fetch refunds using the numeric transaction ID.
    const response = await http.request<PaystackRefundListResponse>({
      method: "GET",
      url: "/refund",
      params: {
        transaction: transactionId,
      },
    });

    const data = assertPaystackResponse(
      response.data,
      "refund listing",
    );

    return {
      provider: PaymentProvider.PAYSTACK,
      refunds: data.map((refund) => {
        const transactionReference = getRefundProviderReference(
          refund.transaction,
        );

        return {
          providerRefundReference: String(refund.id),
          providerReference: transactionReference,
          amount: fromSubunit(refund.amount),
          currency: normalizeCurrency(refund.currency),
          status: mapRefundStatus(refund.status),
          providerStatus: refund.status,
          failureReason:
            refund.status.trim().toLowerCase() === "failed"
              ? (refund.reason ?? undefined)
              : undefined,
          completedAt: refund.refunded_at
            ? new Date(refund.refunded_at)
            : undefined,
          metadata: {
            transactionReference,
            transactionId,
          },
        };
      }),
    };
  };

  return listRefunds;
};