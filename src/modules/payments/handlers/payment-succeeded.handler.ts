import type { PaymentSucceededEvent } from "../../../shared/events/event.types.js";
import type { OrderService } from "../../order/services/order.service.js";

type PaymentSucceededHandlerDependencies = {
  orderService: OrderService;
};

export const createPaymentSucceededHandler = ({
  orderService,
}: PaymentSucceededHandlerDependencies) => {
  const handle = async (event: PaymentSucceededEvent) => {
    const { orderId } = event.data;

    const result = await orderService.confirmOrderFromPayment(orderId);

    if (result.action === "REFUND_REQUIRED") {
      console.log(
        `[Payment] Order ${orderId} expired before payment was confirmed. Refund required.`,
      );
    }
  };

  return {
    handle,
  };
};

export type PaymentSucceededHandler =
  ReturnType<typeof createPaymentSucceededHandler>;