
import { z } from "zod";
import { registry } from "../registry.js";

const NotificationStatusSchema = z.enum(["UNREAD", "READ"]);

const NotificationTypeSchema = z.enum([
  "PAYMENT_PROCESSING",
  "PAYMENT_SUCCESS",
  "PAYMENT_FAILED",
  "PAYMENT_CANCELLED",
  "PAYMENT_EXPIRED",
  "PAYMENT_PARTIALLY_REFUNDED",
  "PAYMENT_REFUNDED",
  "ORDER_CREATED",
  "ORDER_CONFIRMED",
  "ORDER_PROCESSING",
  "ORDER_SHIPPED",
  "ORDER_DELIVERED",
  "ORDER_CANCELLED",
  "ORDER_EXPIRED",
]);

const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  status: NotificationStatusSchema,
  title: z.string(),
  message: z.string(),
  eventId: z.string(),
  eventType: z.string(),
  metadata: z.unknown().nullable().optional(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

const SuccessResponseSchema = z.object({
  success: z.literal(true),
});

const NotificationResponseSchema = SuccessResponseSchema.extend({
  data: NotificationSchema,
});

const NotificationListResponseSchema = SuccessResponseSchema.extend({
  data: z.array(NotificationSchema),
});

const MarkAsReadResponseSchema = SuccessResponseSchema.extend({
  data: z.object({
    count: z.number().int().nonnegative(),
  }),
});

const MarkAllAsReadResponseSchema = MarkAsReadResponseSchema;

const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
});

const NotificationIdParamsSchema = z.object({
  id: z.string().min(1).openapi({
    param: {
      name: "id",
      in: "path",
    },
    example: "cm123notification456",
  }),
});

const ListNotificationsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .openapi({
      param: {
        name: "limit",
        in: "query",
      },
      description: "Maximum number of notifications to return.",
      example: 20,
    }),

  cursor: z.string().optional().openapi({
    param: {
      name: "cursor",
      in: "query",
    },
    description:
      "Notification ID used as the cursor for the next page.",
    example: "cm123notification456",
  }),

  unreadOnly: z.coerce
    .boolean()
    .default(false)
    .openapi({
      param: {
        name: "unreadOnly",
        in: "query",
      },
      description: "When true, return only unread notifications.",
      example: true,
    }),
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications",
  tags: ["Notifications"],
  summary: "List notifications",
  description:
    "Returns notifications belonging to the authenticated user, ordered from newest to oldest. Supports cursor pagination and unread filtering.",
  security: [{ bearerAuth: [] }],
  request: {
    query: ListNotificationsQuerySchema,
  },
  responses: {
    200: {
      description: "Notifications retrieved successfully.",
      content: {
        "application/json": {
          schema: NotificationListResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid query parameters.",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required.",
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/v1/notifications/{id}",
  tags: ["Notifications"],
  summary: "Get a notification",
  description:
    "Returns a notification belonging to the authenticated user.",
  security: [{ bearerAuth: [] }],
  request: {
    params: NotificationIdParamsSchema,
  },
  responses: {
    200: {
      description: "Notification retrieved successfully.",
      content: {
        "application/json": {
          schema: NotificationResponseSchema,
        },
      },
    },
    400: {
      description:
        "Invalid notification ID, notification not found, or notification does not belong to the authenticated user.",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required.",
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/notifications/read-all",
  tags: ["Notifications"],
  summary: "Mark all notifications as read",
  description:
    "Marks all unread notifications belonging to the authenticated user as read.",
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: "Notifications updated successfully.",
      content: {
        "application/json": {
          schema: MarkAllAsReadResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required.",
    },
  },
});

registry.registerPath({
  method: "patch",
  path: "/api/v1/notifications/{id}/read",
  tags: ["Notifications"],
  summary: "Mark a notification as read",
  description:
    "Marks a notification as read if it belongs to the authenticated user and is currently unread.",
  security: [{ bearerAuth: [] }],
  request: {
    params: NotificationIdParamsSchema,
  },
  responses: {
    200: {
      description:
        "The update operation completed. A count of zero means no unread notification matched.",
      content: {
        "application/json": {
          schema: MarkAsReadResponseSchema,
        },
      },
    },
    400: {
      description: "Invalid notification ID.",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Authentication required.",
    },
  },
});
