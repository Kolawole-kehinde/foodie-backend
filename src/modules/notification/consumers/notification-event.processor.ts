
import { randomUUID } from "node:crypto";
import { InboxEventStatus, Prisma } from "@prisma/client";

import type { DomainEvent } from "../../../shared/events/event.types.js";
import type { DatabaseClient } from "../../../database/prisma/types.js";
import { createInboxRepository } from "../repositories/inbox.repository.js";
import type { NotificationEventRouter } from "./notification-event.router.js";

const LEASE_DURATION_MS = 60_000;
const LEASE_RENEW_INTERVAL_MS = 20_000;

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

    const claimToken = randomUUID();

    if (!inboxEvent) {
      try {
        inboxEvent = await inboxRepository.create({
          eventId: event.eventId,
          eventType: event.eventType,
          status: InboxEventStatus.PROCESSING,
          claimToken,
          leaseExpiresAt: new Date(Date.now() + LEASE_DURATION_MS),
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

        // Another worker may have inserted this event concurrently.
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
          claimToken,
          LEASE_DURATION_MS,
        );

        if (!claimed) {
          throw new Error(
            `Notification event is already claimed: ${event.eventId}`,
          );
        }
      }
    } else {
      const claimed = await inboxRepository.claimForProcessing(
        event.eventId,
        claimToken,
        LEASE_DURATION_MS,
      );

      if (!claimed) {
        throw new Error(
          `Notification event is already claimed: ${event.eventId}`,
        );
      }
    }

    let leaseLost = false;
    let leaseRenewalError: unknown;

    const renewalTimer = setInterval(() => {
      void inboxRepository
        .renewLease(event.eventId, claimToken, LEASE_DURATION_MS)
        .then((renewed) => {
          if (!renewed) {
            leaseLost = true;

            console.error("[Notification] Processing lease lost", {
              eventId: event.eventId,
            });
          }
        })
        .catch((error: unknown) => {
          leaseLost = true;
          leaseRenewalError = error;

          console.error("[Notification] Lease renewal failed", {
            eventId: event.eventId,
            error:
              error instanceof Error ? error.message : "Unknown error",
          });
        });
    }, LEASE_RENEW_INTERVAL_MS);

    try {
      await router.route(event);

      if (leaseLost) {
        throw new Error(
          `Notification processing lease was lost: ${event.eventId}`,
          { cause: leaseRenewalError },
        );
      }

      const processed = await inboxRepository.markProcessed(
        event.eventId,
        claimToken,
      );

      if (!processed) {
        throw new Error(
          `Cannot complete notification event without a valid lease: ${event.eventId}`,
        );
      }

      console.info("[Notification] Event processed successfully", {
        eventId: event.eventId,
        eventType: event.eventType,
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : "Unknown processing error";

      try {
        const markedFailed = await inboxRepository.markFailed(
          event.eventId,
          claimToken,
          failureReason,
        );

        if (!markedFailed) {
          console.warn(
            "[Notification] Failure status not updated because the claim is no longer valid",
            { eventId: event.eventId },
          );
        }
      } catch (statusError) {
        console.error(
          "[Notification] Failed to record processing failure",
          {
            eventId: event.eventId,
            processingError: failureReason,
            statusError:
              statusError instanceof Error
                ? statusError.message
                : "Unknown status update error",
          },
        );
      }

      throw error;
    } finally {
      clearInterval(renewalTimer);
    }
  };

  return { process };
};

export type NotificationEventProcessor = ReturnType<
  typeof createNotificationEventProcessor
>;
