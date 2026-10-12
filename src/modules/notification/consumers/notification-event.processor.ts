
import { InboxEventStatus, Prisma } from "@prisma/client";

import type { DomainEvent } from "../../../shared/events/event.types.js";
import { createInboxRepository } from "../repositories/inbox.repository.js";
import type { DatabaseClient } from "../../../database/prisma/types.js";
import type { NotificationEventRouter } from "./notification-event.router.js";

type NotificationEventProcessorDependencies = {
  db: DatabaseClient;
  router: NotificationEventRouter;
};

export const createNotificationEventProcessor = ({
  db,
  router,
}: NotificationEventProcessorDependencies) => {
  const inboxRepository = createInboxRepository(db);

  const process = async (event: DomainEvent): Promise<void> => {
    let inboxEvent = await inboxRepository.findByEventId(event.eventId);

    if (inboxEvent?.status === InboxEventStatus.PROCESSED) {
      console.info("[Notification] Duplicate event skipped", {
        eventId: event.eventId,
      });
      return;
    }

    if (!inboxEvent) {
      try {
        inboxEvent = await inboxRepository.create({
          eventId: event.eventId,
          eventType: event.eventType,
          status: InboxEventStatus.PROCESSING,
        });
      } catch (error) {
        if (
          !(
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
          )
        ) {
          throw error;
        }

        inboxEvent = await inboxRepository.findByEventId(event.eventId);

        if (!inboxEvent) {
          throw error;
        }

        if (inboxEvent.status === InboxEventStatus.PROCESSED) {
          console.info("[Notification] Duplicate event skipped", {
            eventId: event.eventId,
          });
          return;
        }

        const claimed = await inboxRepository.claimForProcessing(
          event.eventId,
        );

        if (!claimed) {
          console.info("[Notification] Event is already being processed", {
            eventId: event.eventId,
            status: inboxEvent.status,
          });
          return;
        }
      }
    } else {
      const claimed = await inboxRepository.claimForProcessing(event.eventId);

      if (!claimed) {
        console.info("[Notification] Event could not be claimed", {
          eventId: event.eventId,
          status: inboxEvent.status,
        });
        return;
      }
    }

    try {
      const handled = await router.route(event);

      if (!handled) {
        // Preserve existing behavior for unsupported event types.
        await inboxRepository.updateStatus(event.eventId, {
          status: InboxEventStatus.PROCESSED,
          processedAt: new Date(),
          failureReason: null,
        });
        return;
      }

      await inboxRepository.updateStatus(event.eventId, {
        status: InboxEventStatus.PROCESSED,
        processedAt: new Date(),
        failureReason: null,
      });

      console.info("[Notification] Event processed successfully", {
        eventId: event.eventId,
        eventType: event.eventType,
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : "Unknown processing error";

      await inboxRepository.updateStatus(event.eventId, {
        status: InboxEventStatus.FAILED,
        failureReason,
      });

      throw error;
    }
  };

  return { process };
};

export type NotificationEventProcessor = ReturnType<
  typeof createNotificationEventProcessor
>;
