import { RefundStatus } from "@prisma/client";

import type { PaymentProviderStatus } from "../../types/payment.types.js";

export const mapProviderRefundStatus = (
  status: PaymentProviderStatus,
): RefundStatus => {
  switch (status) {
    case "SUCCESS":
      return RefundStatus.SUCCESS;

    case "FAILED":
      return RefundStatus.FAILED;

    case "CANCELLED":
      return RefundStatus.CANCELLED;

    case "PROCESSING":
    case "PENDING":
    case "EXPIRED":
    case "UNKNOWN":
    default:
      return RefundStatus.PROCESSING;
  }
};