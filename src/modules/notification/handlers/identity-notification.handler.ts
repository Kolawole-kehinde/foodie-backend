import { NotificationStatus, NotificationType, Prisma,} from "@prisma/client";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { IdentityEvent } from "../../../shared/events/event.types.js";
import type { NotificationService } from "../services/notification.service.js";
import { identityNotificationTemplate } from "../templates/identity-notification.template.js";


type IdentityNotificationHandlerDependencies = {
  notificationService: NotificationService;
};

export const createIdentityNotificationHandler = ({
  notificationService,
}: IdentityNotificationHandlerDependencies) => {
  const handle = async (event: IdentityEvent): Promise<void> => {
    let userId: string;
    let type: NotificationType;
    let template: ReturnType<typeof identityNotificationTemplate>;

    switch (event.eventType) {
      case EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_REQUESTED:
        userId = "";
        type = NotificationType.IDENTITY_EMAIL_VERIFICATION_REQUESTED;

        template = identityNotificationTemplate(event, {
          verificationOtp: event.data.verificationOtp,
        });
        break;

      case EVENT_TYPES.IDENTITY_EMAIL_VERIFICATION_RESENT:
        userId = "";
        type = NotificationType.IDENTITY_EMAIL_VERIFICATION_RESENT;

        template = identityNotificationTemplate(event, {
          verificationOtp: event.data.verificationOtp,
        });
        break;

      case EVENT_TYPES.IDENTITY_EMAIL_VERIFIED:
        userId = event.data.userId;
        type = NotificationType.IDENTITY_EMAIL_VERIFIED;
        template = identityNotificationTemplate(event);
        break;

      case EVENT_TYPES.IDENTITY_PASSWORD_RESET_REQUESTED:
        userId = event.data.userId;
        type = NotificationType.IDENTITY_PASSWORD_RESET_REQUESTED;

        template = identityNotificationTemplate(event, {
          resetUrl: event.data.resetUrl,
        });
        break;

      case EVENT_TYPES.IDENTITY_PASSWORD_RESET_COMPLETED:
        userId = event.data.userId;
        type = NotificationType.IDENTITY_PASSWORD_RESET_COMPLETED;
        template = identityNotificationTemplate(event);
        break;

      default:
          throw new Error("Unsupported identity notification event");
        
    }

    // Requested verification events have no active User yet.
    // Resolve the user ID only for events that require an in-app notification.
    const inApp = template.inApp;

    if (!inApp && !template.email) {
      throw new Error(
        `No notification content generated for identity event: ${event.eventType}`,
      );
    }

    // Email-only events must still create a Notification because
    // NotificationDelivery is created by notificationService.create().
    if (!userId) {
      throw new Error(
        `Cannot create identity notification without a user ID: ${event.eventType}. ` +
          "Resolve the user ID or use a dedicated email-recipient delivery path.",
      );
    }

    try {
      await notificationService.create({
        userId,
        type,
        status: NotificationStatus.UNREAD,
        title: inApp?.title ?? template.email.subject,
        message: inApp?.message ?? template.email.text,
        eventId: event.eventId,
        eventType: event.eventType,
        metadata: {
          email: {
            to: template.email.to,
            subject: template.email.subject,
            text: template.email.text,
            html: template.email.html,
          },
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