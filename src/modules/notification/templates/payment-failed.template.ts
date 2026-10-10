type PaymentFailedTemplateInput = {
  orderId: string;
  amount: string | number;
  currency: string;
};

export const paymentFailedTemplate = (data: PaymentFailedTemplateInput) => {
  const { orderId, amount, currency } = data;

  const title = "Payment failed";
  const message = `Your payment of ${currency} ${amount} for order ${orderId} could not be completed. Please try again.`;

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