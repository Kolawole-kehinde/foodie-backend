import type { PaymentSucceededEvent } from "../../../shared/events/event.types.js";

type PaymentSuccessTemplateInput = PaymentSucceededEvent["data"];

export const paymentSuccessTemplate = (data: PaymentSuccessTemplateInput) => {
  const { orderId, amount, currency } = data;

  const title = "Payment successful";
  const message = `Your payment of ${currency} ${amount} for order ${orderId} was successful.`;

  return {
    inApp: {
      title,
      message,
    },
    email: {
      subject: title,
      text: message,
      html: `
        <h2>${title}</h2>
        <p>${message}</p>
        <p>Order reference: ${orderId}</p>
      `,
    },
  };
};