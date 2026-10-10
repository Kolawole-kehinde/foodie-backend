type PaymentRefundedTemplateInput = {
  orderId: string;
  amount: string | number;
  currency: string;
};

export const paymentRefundedTemplate = (data: PaymentRefundedTemplateInput) => {
  const { orderId, amount, currency } = data;

  const title = "Payment refunded";
  const message = `Your refund of ${currency} ${amount} for order ${orderId} has been processed.`;

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