
import {
  EVENT_TYPES,
  type OrderEvent,
} from "../../../shared/events/event.types.js";

type OrderNotificationTemplateOptions = {
  clientUrl?: string;
};

type OrderNotificationTemplateResult = {
  inApp: {
    title: string;
    message: string;
  };
  email: {
    subject: string;
    text: string;
    html: string;
  };
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const orderNotificationTemplate = (
  event: OrderEvent,
  { clientUrl }: OrderNotificationTemplateOptions = {},
): OrderNotificationTemplateResult => {
  const { orderId } = event.data;

  let title: string;
  let message: string;

  switch (event.eventType) {
    case EVENT_TYPES.ORDER_CREATED:
      title = "Order received";
      message = `We've received your order ${orderId}.`;
      break;

    case EVENT_TYPES.ORDER_CONFIRMED:
      title = "Order confirmed";
      message = `Your order ${orderId} has been confirmed.`;
      break;

    case EVENT_TYPES.ORDER_PROCESSING:
      title = "Order processing";
      message = `Your order ${orderId} is being prepared.`;
      break;

    case EVENT_TYPES.ORDER_SHIPPED:
      title = "Order shipped";
      message = `Your order ${orderId} has been shipped.`;
      break;

    case EVENT_TYPES.ORDER_DELIVERED:
      title = "Order delivered";
      message = `Your order ${orderId} has been marked as delivered.`;
      break;

    case EVENT_TYPES.ORDER_CANCELLED:
      title = "Order cancelled";
      message = `Your order ${orderId} has been cancelled.`;
      break;

    case EVENT_TYPES.ORDER_EXPIRED:
      title = "Order expired";
      message = `Your order ${orderId} has expired.`;
      break;
  }

  const safeOrderId = escapeHtml(orderId);
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  const orderUrl = clientUrl
    ? `${clientUrl.replace(/\/+$/, "")}/orders/${encodeURIComponent(orderId)}`
    : undefined;

  const viewOrderButton = orderUrl
    ? `
      <p style="margin:28px 0 0;">
        <a
          href="${escapeHtml(orderUrl)}"
          style="
            display:inline-block;
            padding:12px 22px;
            background:#15803d;
            color:#ffffff;
            text-decoration:none;
            border-radius:8px;
            font-weight:600;
          "
        >
          View Order
        </a>
      </p>
    `
    : "";

  const html = `
    <div style="
      margin:0;
      padding:32px 16px;
      background:#f4f7f4;
      font-family:Arial,Helvetica,sans-serif;
      color:#1f2937;
    ">
      <div style="
        max-width:560px;
        margin:0 auto;
        background:#ffffff;
        border-radius:16px;
        overflow:hidden;
        border:1px solid #e5e7eb;
      ">
        <div style="
          padding:26px 32px;
          background:#166534;
          color:#ffffff;
        ">
          <p style="
            margin:0 0 8px;
            font-size:13px;
            font-weight:700;
            letter-spacing:2px;
          ">
            FOODIE
          </p>
          <h1 style="margin:0;font-size:25px;">
            ${safeTitle}
          </h1>
        </div>

        <div style="padding:32px;">
          <p style="font-size:16px;line-height:1.7;">
            ${safeMessage}
          </p>

          <div style="
            margin-top:24px;
            padding:18px;
            background:#f9fafb;
            border:1px solid #e5e7eb;
            border-radius:10px;
          ">
            <p style="
              margin:0 0 6px;
              color:#6b7280;
              font-size:12px;
            ">
              ORDER REFERENCE
            </p>
            <p style="
              margin:0;
              font-size:15px;
              font-weight:700;
              overflow-wrap:anywhere;
            ">
              ${safeOrderId}
            </p>
          </div>

          ${viewOrderButton}

          <p style="
            margin:32px 0 0;
            color:#6b7280;
            font-size:13px;
            line-height:1.6;
          ">
            Thank you for choosing Foodie.
          </p>
        </div>
      </div>
    </div>
  `;

  return {
    inApp: {
      title,
      message,
    },
    email: {
      subject: `${title} — Foodie`,
      text: `${message}\n\nOrder reference: ${orderId}`,
      html,
    },
  };
};
