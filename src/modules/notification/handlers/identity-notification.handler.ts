
import {
  NotificationStatus,
  NotificationType,
  Prisma,
} from "@prisma/client";

import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { IdentityEvent } from "../../../shared/events/event.types.js";
import type { NotificationService } from "../services/notification.service.js";

type IdentityNotificationHandlerDependencies = {
  notificationService: NotificationService;
};

export const createIdentityNotificationHandler = ({
  notificationService,
}: IdentityNotificationHandlerDependencies) => {
  const handle = async (event: IdentityEvent): Promise<boolean> => {
    let userId: string;
    let email: string;
    let type: NotificationType;
    let title: string;
    let message: string;

    switch (event.eventType) {
      case EVENT_TYPES.IDENTITY_EMAIL_VERIFIED:
        userId = event.data.userId;
        email = event.data.email;
        type = NotificationType.;
        title = "Email verified";
        message = "Your email address has been successfully verified.";
        break;

      case EVENT_TYPES.IDENTITY_PASSWORD_RESET_COMPLETED:
        userId = event.data.userId;
        email = event.data.email;
        type = NotificationType.IDENTITY_PASSWORD_RESET_COMPLETED;
        title = "Password changed";
        message = "Your password has been successfully changed.";
        break;

      default:
        // Request events need secure email delivery before being handled here.
        return false;
    }

    try {
      await notificationService.create({
        userId,
        type,
        status: NotificationStatus.UNREAD,
        title,
        message,
        eventId: event.eventId,
        eventType: event.eventType,
        metadata: {
          email,
        } as Prisma.InputJsonValue,
      });

      return true;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        console.info(
          `[Notification] Duplicate identity notification skipped: ${event.eventId}`,
        );

        return true;
      }

      throw error;
    }
  };

  return { handle };
};

export type IdentityNotificationHandler = ReturnType<
  typeof createIdentityNotificationHandler
>;
