
import {
  EVENT_TYPES,
  type PaymentEvent,
} from "../../../shared/events/event.types.js";

type PaymentNotificationTemplateOptions = {
  clientUrl?: string;
};

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character]!;
  });

const getPaymentContent = (event: PaymentEvent) => {
  switch (event.eventType) {
    case EVENT_TYPES.PAYMENT_PROCESSING:
      return {
        title: "Payment processing",
        message: "Your payment is being processed.",
        subject: "Your Foodie payment is being processed",
      };

    case EVENT_TYPES.PAYMENT_SUCCEEDED:
      return {
        title: "Payment successful",
        message: "Your payment was completed successfully.",
        subject: "Your Foodie payment was successful",
      };

    case EVENT_TYPES.PAYMENT_FAILED:
      return {
        title: "Payment failed",
        message:
          "Your payment could not be completed. Please check your payment details or try again.",
        subject: "Your Foodie payment could not be completed",
      };

    case EVENT_TYPES.PAYMENT_CANCELLED:
      return {
        title: "Payment cancelled",
        message: "Your payment was cancelled.",
        subject: "Your Foodie payment was cancelled",
      };

    case EVENT_TYPES.PAYMENT_EXPIRED:
      return {
        title: "Payment expired",
        message:
          "Your payment session has expired. You may try again if your order is still available.",
        subject: "Your Foodie payment session expired",
      };

    case EVENT_TYPES.PAYMENT_PARTIALLY_REFUNDED:
      return {
        title: "Partial refund processed",
        message:
          "A partial refund has been processed for your payment. The time it takes to appear depends on your payment provider.",
        subject: "Your Foodie partial refund has been processed",
      };

    case EVENT_TYPES.PAYMENT_REFUNDED:
      return {
        title: "Payment refunded",
        message:
          "Your payment has been refunded. The time it takes to appear depends on your payment provider.",
        subject: "Your Foodie refund has been processed",
      };
  }
};

export const paymentNotificationTemplate = (
  event: PaymentEvent,
  { clientUrl }: PaymentNotificationTemplateOptions = {},
) => {
  const content = getPaymentContent(event);
  const { paymentId, orderId, amount, currency, providerReference } =
    event.data;

  const safePaymentId = escapeHtml(paymentId);
  const safeOrderId = escapeHtml(orderId);
  const safeAmount = escapeHtml(amount);
  const safeCurrency = escapeHtml(currency);
  const safeProviderReference = providerReference
    ? escapeHtml(providerReference)
    : null;

  const orderUrl = clientUrl
    ? `${clientUrl.replace(/\/+$/, "")}/orders/${encodeURIComponent(orderId)}`
    : undefined;

  const button = orderUrl
    ? `
      <p style="margin:28px 0 0;">
        <a
          href="${escapeHtml(orderUrl)}"
          style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;"
        >
          View your order
        </a>
      </p>
    `
    : "";

  const referenceRow = safeProviderReference
    ? `
      <tr>
        <td style="padding:8px 0;color:#64748b;">Provider reference</td>
        <td style="padding:8px 0;text-align:right;color:#0f172a;">${safeProviderReference}</td>
      </tr>
    `
    : "";

  const text = [
    "Foodie",
    "",
    content.title,
    content.message,
    "",
    `Payment amount: ${currency} ${amount}`,
    `Payment ID: ${paymentId}`,
    `Order ID: ${orderId}`,
    ...(providerReference
      ? [`Provider reference: ${providerReference}`]
      : []),
    ...(orderUrl ? ["", `View your order: ${orderUrl}`] : []),
    "",
    "If you have questions about this payment, please contact our support team.",
  ].join("\n");

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(content.subject)}</title>
      </head>
      <body style="margin:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
            <div style="background:#ea580c;padding:24px 32px;color:#ffffff;">
              <p style="margin:0;font-size:24px;font-weight:700;">Foodie</p>
              <p style="margin:8px 0 0;font-size:14px;">Payment update</p>
            </div>

            <div style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">
                ${escapeHtml(content.title)}
              </h1>

              <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569;">
                ${escapeHtml(content.message)}
              </p>

              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:20px;">
                <p style="margin:0 0 12px;font-size:12px;color:#9a3412;text-transform:uppercase;letter-spacing:1px;">
                  Payment details
                </p>

                <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Payment amount</td>
                    <td style="padding:8px 0;text-align:right;font-weight:600;color:#0f172a;">
                      ${safeCurrency} ${safeAmount}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Payment ID</td>
                    <td style="padding:8px 0;text-align:right;color:#0f172a;">${safePaymentId}</td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;color:#64748b;">Order ID</td>
                    <td style="padding:8px 0;text-align:right;color:#0f172a;">${safeOrderId}</td>
                  </tr>
                  ${referenceRow}
                </table>
              </div>

              ${button}

              <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                If you have questions about this payment, please contact our support team.
              </p>
            </div>
          </div>

          <p style="margin:20px 0 0;text-align:center;font-size:12px;color:#94a3b8;">
            This is an automated message from Foodie.
          </p>
        </div>
      </body>
    </html>
  `;

  return {
    inApp: {
      title: content.title,
      message: content.message,
    },
    email: {
      subject: content.subject,
      text,
      html,
    },
  };
};
