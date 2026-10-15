
import {
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { IdentityEvent } from "../../../shared/events/event.types.js";
import type { NotificationService } from "../services/notification.service.js";
import { identityNotificationTemplate } from "../templates/identity-notification.template.js";

type IdentityNotificationHandlerDependencies = {
  notificationService: NotificationService;
  clientUrl?: string;
};

export const createIdentityNotificationHandler = ({
  notificationService,
}: IdentityNotificationHandlerDependencies) => {
  const handle = async (event: IdentityEvent): Promise<void> => {
    let userId: string;
    let type: NotificationType;

    switch (event.eventType) {
      case EVENT_TYPES.IDENTITY_EMAIL_VERIFIED:
        userId = event.data.userId;
        type = NotificationType.IDENTITY_EMAIL_VERIFIED;
        break;

      case EVENT_TYPES.IDENTITY_PASSWORD_RESET_COMPLETED:
        userId = event.data.userId;
        type = NotificationType.IDENTITY_PASSWORD_RESET_COMPLETED;
        break;

      default:
        throw new Error(
          `Unsupported identity notification event: ${event.eventType}`,
        );
    }

    const template = identityNotificationTemplate(event);

    if (!template.inApp) {
      throw new Error(
        `Missing in-app template for identity event: ${event.eventType}`,
      );
    }

    try {
      await notificationService.create({
        userId,
        type,
        status: NotificationStatus.UNREAD,
        title: template.inApp.title,
        message: template.inApp.message,
        eventId: event.eventId,
        eventType: event.eventType,
        metadata: {
          email: event.data.email,
        } as Prisma.InputJsonValue,
      });
    } catch (error) {
      
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.info(
          "[Notification] Duplicate identity notification skipped",
          { eventId: event.eventId },
        );

        return;
      }

      throw error;
    }
  };

  return { handle };
};

export type IdentityNotificationHandler = ReturnType<
  typeof createIdentityNotificationHandler
>;
