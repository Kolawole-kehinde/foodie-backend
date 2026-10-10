import { Kafka, type Consumer } from "kafkajs";
import { InboxEventStatus, Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { DomainEvent } from "../../../shared/events/event.types.js";
import type { PaymentSucceededNotificationHandler } from "../handlers/payment-succeeded-notification.handler.js";
import { createInboxRepository } from "../repositories/inbox.repository.js";

type NotificationConsumerDependencies = {
  db: DatabaseClient;
  handler: PaymentSucceededNotificationHandler;
  brokers?: string[];
};

type PaymentSucceededEvent = Extract<
  DomainEvent,
  { eventType: typeof EVENT_TYPES.PAYMENT_SUCCEEDED }
>;

const TOPIC = "domain-events";
const GROUP_ID = "foodie-notification-consumer";

export const createNotificationConsumer = ({
  db,
  handler,
  brokers = ["localhost:9092"],
}: NotificationConsumerDependencies) => {
  const kafka = new Kafka({
    clientId: "foodie-notification-service",
    brokers,
  });

  const consumer: Consumer = kafka.consumer({
    groupId: GROUP_ID,
  });

  const inboxRepository = createInboxRepository(db);

  const processEvent = async (event: PaymentSucceededEvent) => {
    let inboxEvent = await inboxRepository.findByEventId(event.eventId);

    if (inboxEvent?.status === InboxEventStatus.PROCESSED) {
      console.info("[Notification] Duplicate event skipped", {
        eventId: event.eventId,
      });
      return;
    }

    if (!inboxEvent) {
      try {
        // The first delivery claims the event by creating it atomically.
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

        // Another delivery may have created the event.
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

        // Atomically claim FAILED or stale PROCESSING events.
        const claimed = await inboxRepository.claimForProcessing(event.eventId);

        if (!claimed) {
          console.info("[Notification] Event is already being processed", {
            eventId: event.eventId,
            status: inboxEvent.status,
          });
          return;
        }
      }
    } else {
      // Existing FAILED or stale PROCESSING event.
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
      await handler.handle(event);

      await inboxRepository.updateStatus(event.eventId, {
        status: InboxEventStatus.PROCESSED,
        processedAt: new Date(),
        failureReason: null,
      });

      console.info("[Notification] Event processed successfully", {
        eventId: event.eventId,
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

  const connect = async () => {
    await consumer.connect();

    await consumer.subscribe({
      topic: TOPIC,
      fromBeginning: false,
    });

    console.info("[Notification] Connected and subscribed", {
      topic: TOPIC,
      groupId: GROUP_ID,
    });
  };

  const start = async () => {
    console.info("[Notification] Starting message processing");

    await consumer.run({
      autoCommit: false,

      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          throw new Error("Kafka message has no value");
        }

        const rawEvent: unknown = JSON.parse(message.value.toString());
        const result = domainEventSchema.safeParse(rawEvent);

        if (!result.success) {
          throw new Error(`Invalid domain event: ${result.error.message}`);
        }

        const event = result.data;

        console.info("[KAFKA EVENT RECEIVED]", {
          consumer: "notification",
          eventId: event.eventId,
          eventType: event.eventType,
          topic,
          partition,
          offset: message.offset,
        });

        if (event.eventType === EVENT_TYPES.PAYMENT_SUCCEEDED) {
          await processEvent(event);
        }

        // Commit after successful processing or a safe duplicate skip.
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (BigInt(message.offset) + 1n).toString(),
          },
        ]);
      },
    });
  };

  const disconnect = async () => {
    await consumer.disconnect();
  };

  return {
    connect,
    start,
    disconnect,
  };
};

export type NotificationConsumer = ReturnType<
  typeof createNotificationConsumer
>;
