import type { PaymentSucceededEvent } from "../../../shared/events/event.types.js";

type PaymentSuccessTemplateInput = PaymentSucceededEvent["data"];

type PaymentSuccessTemplateOptions = {
  clientUrl?: string;
};

const escapeHtml = (value: string | number): string =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const createOrderUrl = (
  clientUrl: string | undefined,
  orderId: string,
): string | undefined => {
  if (!clientUrl) return undefined;

  try {
    const baseUrl = new URL(clientUrl);

    if (!["http:", "https:"].includes(baseUrl.protocol)) {
      return undefined;
    }

    return new URL(
      `/orders/${encodeURIComponent(orderId)}`,
      baseUrl,
    ).toString();
  } catch {
    return undefined;
  }
};

export const paymentSuccessTemplate = (
  data: PaymentSuccessTemplateInput,
  options: PaymentSuccessTemplateOptions = {},
) => {
  const { orderId, amount, currency } = data;

  const title = "Payment successful";
  const message = `Your payment of ${currency} ${amount} for order ${orderId} was successful.`;

  const safeOrderId = escapeHtml(orderId);
  const safeAmount = escapeHtml(amount);
  const safeCurrency = escapeHtml(currency);
  const orderUrl = createOrderUrl(options.clientUrl, orderId);

  const orderButton = orderUrl
    ? `
      <div style="text-align: center; margin: 28px 0;">
        <a
          href="${escapeHtml(orderUrl)}"
          style="
            display: inline-block;
            padding: 13px 24px;
            background-color: #16a34a;
            color: #ffffff;
            text-decoration: none;
            font-weight: 600;
            border-radius: 8px;
          "
        >
          View Order
        </a>
      </div>
    `
    : "";

  const text = [
    "Foodie",
    "",
    title,
    message,
    "",
    `Order reference: ${orderId}`,
    ...(orderUrl ? ["", `View your order: ${orderUrl}`] : []),
    "",
    "Thank you for choosing Foodie.",
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
      </head>
      <body style="
        margin: 0;
        padding: 24px 12px;
        background-color: #f4f6f8;
        font-family: Arial, Helvetica, sans-serif;
        color: #1f2937;
      ">
        <div style="
          max-width: 560px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
        ">
          <div style="
            padding: 24px;
            background-color: #15803d;
            color: #ffffff;
          ">
            <h1 style="margin: 0; font-size: 26px;">Foodie</h1>
            <p style="margin: 8px 0 0; font-size: 14px;">
              Good food. Easy ordering.
            </p>
          </div>

          <div style="padding: 28px 24px;">
            <h2 style="margin-top: 0; font-size: 22px;">
              ${title}
            </h2>

            <p style="font-size: 15px; line-height: 1.7;">
              Your payment has been confirmed. Thank you for choosing Foodie.
            </p>

            <div style="
              margin: 24px 0;
              padding: 20px;
              background-color: #f9fafb;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
            ">
              <p style="margin: 0 0 14px; color: #6b7280; font-size: 13px;">
                PAYMENT SUMMARY
              </p>

              <p style="margin: 0 0 12px;">
                <strong>Amount paid</strong><br>
                <span style="font-size: 20px; font-weight: 700;">
                  ${safeCurrency} ${safeAmount}
                </span>
              </p>

              <p style="margin: 0;">
                <strong>Order reference</strong><br>
                <span style="overflow-wrap: anywhere;">${safeOrderId}</span>
              </p>
            </div>

            ${orderButton}

            <p style="font-size: 14px; line-height: 1.7; color: #4b5563;">
              Keep this email for your records. You can refer to your order
              reference if you need help with your purchase.
            </p>
          </div>

          <div style="
            padding: 18px 24px;
            background-color: #f9fafb;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 12px;
            line-height: 1.6;
          ">
            <p style="margin: 0;">
              Thank you for choosing Foodie.
            </p>
            <p style="margin: 6px 0 0;">
              This is an automated payment confirmation. Please do not reply
              directly to this email.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return {
    inApp: {
      title,
      message,
    },
    email: {
      subject: `Foodie | ${title}`,
      text,
      html,
    },
  };
};
