
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

type LeaseHeartbeatState = {
  leaseLost: boolean;
  leaseRenewalError: unknown;
};

export const createNotificationEventProcessor = ({
  db,
  router,
}: NotificationEventProcessorDependencies) => {
  const inboxRepository = createInboxRepository(db);

  const startLeaseHeartbeat = (
    eventId: string,
    claimToken: string,
  ) => {
    let stopped = false;
    let leaseLost = false;
    let leaseRenewalError: unknown;

    let renewalTimer: ReturnType<typeof setTimeout> | undefined;
    let renewalInProgress: Promise<void> | undefined;

    const scheduleRenewal = () => {
      if (stopped || leaseLost) {
        return;
      }

      renewalTimer = setTimeout(() => {
        renewalInProgress = renewLease();
      }, LEASE_RENEW_INTERVAL_MS);
    };

    const renewLease = async (): Promise<void> => {
      try {
        const renewed = await inboxRepository.renewLease(
          eventId,
          claimToken,
          LEASE_DURATION_MS,
        );

        if (!renewed) {
          leaseLost = true;

          console.error("[Notification] Processing lease lost", {
            eventId,
          });

          return;
        }
      } catch (error: unknown) {
        leaseLost = true;
        leaseRenewalError = error;

        console.error("[Notification] Lease renewal failed", {
          eventId,
          error:
            error instanceof Error ? error.message : "Unknown error",
        });

        return;
      } finally {
        renewalInProgress = undefined;
        scheduleRenewal();
      }
    };

    scheduleRenewal();

    const stop = async (): Promise<LeaseHeartbeatState> => {
      stopped = true;

      if (renewalTimer) {
        clearTimeout(renewalTimer);
        renewalTimer = undefined;
      }

      // Wait for a renewal already in progress before changing inbox status.
      await renewalInProgress;

      return {
        leaseLost,
        leaseRenewalError,
      };
    };

    return { stop };
  };

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

    const heartbeat = startLeaseHeartbeat(event.eventId, claimToken);

    try {
      await router.route(event);

      const heartbeatState = await heartbeat.stop();

      if (heartbeatState.leaseLost) {
        throw new Error(
          `Notification processing lease was lost: ${event.eventId}`,
          { cause: heartbeatState.leaseRenewalError },
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
      // Stop and settle the heartbeat before attempting to mark the event failed.
      await heartbeat.stop();

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
        console.error("[Notification] Failed to record processing failure", {
          eventId: event.eventId,
          processingError: failureReason,
          statusError:
            statusError instanceof Error
              ? statusError.message
              : "Unknown status update error",
        });
      }

      throw error;
    }
  };

  return { process };
};

export type NotificationEventProcessor = ReturnType<
  typeof createNotificationEventProcessor
>;
