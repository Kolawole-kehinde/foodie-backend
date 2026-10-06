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

    await orderService.confirmOrder(orderId);
  };

  return {
    handle,
  };
};

export type PaymentSucceededHandler =
  ReturnType<typeof createPaymentSucceededHandler>;