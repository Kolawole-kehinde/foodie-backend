import { OrderStatus, PaymentProvider } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";

type PaymentProcessingServiceDependencies = {
  db: DatabaseClient;
};

type InitializePaymentContextInput = {
  orderId: string;
  userId: string;
  provider: PaymentProvider;
};

export const createPaymentProcessingService = ({
  db,
}: PaymentProcessingServiceDependencies) => {
  const preparePayment = async ({
    orderId,
    userId,
    provider,
  }: InitializePaymentContextInput) => {
   
    // 1. Load the order
    const order = await db.order.findUnique({
      where: {
        id: orderId,
      },
      select: {
        id: true,
        userId: true,
        status: true,
        totalAmount: true,
        reservationExpiresAt: true,
        user: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!order) {
      throw new Error("Order not found");
    }

   
    // 2. Verify ownership
    if (order.userId !== userId) {
      throw new Error("You cannot pay for this order");
    }

    // 3. Verify order status
    if (order.status !== OrderStatus.PENDING) {
      throw new Error(
        `Order cannot be paid in its current status: ${order.status}`,
      );
    }

    // 4. Verify inventory reservation
    if (
      !order.reservationExpiresAt ||
      order.reservationExpiresAt <= new Date()
    ) {
      throw new Error("Order inventory reservation has expired");
    }


    // 5. Determine trusted payment values
    // The client does NOT provide the amount or email.  Both come from our database.
    // Currency is currently fixed to NGN because this
    // application is using Nigerian payment providers.
    // This can later move into configuration if we add
    // multi-currency support.

    const amount = order.totalAmount.toFixed(2);
    const currency = "NGN";

    return {
      orderId: order.id,
      userId: order.userId,
      amount,
      currency,
      customerEmail: order.user.email,
      provider,
    };
  };

  return {
    preparePayment,
  };
};

export type PaymentProcessingService = ReturnType<
  typeof createPaymentProcessingService
>;
