import { Kafka, type Consumer } from "kafkajs";
import { Prisma } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { PaymentSucceededNotificationHandler } from "../handlers/payment-succeeded-notification.handler.js";
import { createInboxRepository } from "../repositories/inbox.repository.js";


type NotificationConsumerDependencies = {
  db: DatabaseClient;
  handler: PaymentSucceededNotificationHandler;
  brokers?: string[];
};

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

  const processEvent = async ( event: Extract<
      import("../../../shared/events/event.types.js").DomainEvent,
      { eventType: typeof EVENT_TYPES.PAYMENT_SUCCEEDED }
    >,
  ) => {
    let inboxEvent = await inboxRepository.findByEventId(event.eventId);

    if (inboxEvent?.status === "PROCESSED") {
      console.info(
        `[Notification] Event already processed: ${event.eventId}`,
      );
      return;
    }

    if (!inboxEvent) {
      try {
        inboxEvent = await inboxRepository.create({
          eventId: event.eventId,
          eventType: event.eventType,
          status: "PROCESSING",
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

        if (inboxEvent.status === "PROCESSED") {
          return;
        }
      }
    } else {
      await inboxRepository.updateStatus(event.eventId, {
        status: "PROCESSING",
      });
    }

    try {
      await handler.handle(event);

      await inboxRepository.updateStatus(event.eventId, {
        status: "PROCESSED",
        failureReason: null,
      });
    } catch (error) {
      const failureReason =
        error instanceof Error ? error.message : "Unknown processing error";

      await inboxRepository.updateStatus(event.eventId, {
        status: "FAILED",
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
  };

  const start = async () => {
    await consumer.run({
      autoCommit: false,

      eachMessage: async ({ topic, partition, message }) => {
        if (!message.value) {
          throw new Error("Kafka message has no value");
        }

        const rawEvent: unknown = JSON.parse(message.value.toString());
        const result = domainEventSchema.safeParse(rawEvent);

        if (!result.success) {
          throw new Error(
            `Invalid domain event: ${result.error.message}`,
          );
        }

        const event = result.data;

        console.log("[KAFKA EVENT RECEIVED]", {
  consumer: "notification",
  eventId: event.eventId,
  eventType: event.eventType,
});

        if (event.eventType === EVENT_TYPES.PAYMENT_SUCCEEDED) {
          await processEvent(event);
        }

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

  return { connect, start, disconnect };
};

export type NotificationConsumer = ReturnType<
  typeof createNotificationConsumer
>;