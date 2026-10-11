import type { Consumer } from "kafkajs";
import { InboxEventStatus, Prisma } from "@prisma/client";
import type { DatabaseClient } from "../../../database/prisma/types.js";
import { kafka } from "../../../infrastructure/kafka/kafka.client.js";
import {
  connectKafka,
  disconnectKafka,
} from "../../../infrastructure/kafka/kafka.connection.js";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { DomainEvent } from "../../../shared/events/event.types.js";
import type { PaymentSucceededNotificationHandler } from "../handlers/payment-succeeded-notification.handler.js";
import { createInboxRepository } from "../repositories/inbox.repository.js";
import type { PublishToDlqInput } from "../types/dlq.types.js";

// Dependencies required to create the notification consumer.
type NotificationConsumerDependencies = {
  db: DatabaseClient;
  handler: PaymentSucceededNotificationHandler;
};

// Extract the payment-succeeded event type from the domain event union.
type PaymentSucceededEvent = Extract<
  DomainEvent,
  { eventType: typeof EVENT_TYPES.PAYMENT_SUCCEEDED }
>;

const TOPIC = "domain-events";
const DLQ_TOPIC = "domain-events.dlq";
const GROUP_ID = "foodie-notification-consumer";

export const createNotificationConsumer = ({
  db,
  handler,
}: NotificationConsumerDependencies) => {
  // Create a consumer with its own group and a producer for DLQ messages.
  const consumer: Consumer = kafka.consumer({
    groupId: GROUP_ID,
  });

  const producer = kafka.producer();
  const inboxRepository = createInboxRepository(db);

  // Publish malformed messages with enough information to investigate them.
  const publishToDlq = async ({
    topic,
    partition,
    offset,
    timestamp,
    key,
    rawValue,
    failureReason,
  }: PublishToDlqInput) => {
    await producer.send({
      topic: DLQ_TOPIC,
      acks: -1,
      messages: [
        {
          key: key ?? undefined,
          value: JSON.stringify({
            originalMessage: rawValue,
            failureReason,
            source: {
              topic,
              partition,
              offset,
              timestamp,
            },
            failedAt: new Date().toISOString(),
          }),
          headers: {
            "failure-reason": failureReason,
            "original-topic": topic,
            "original-partition": String(partition),
            "original-offset": offset,
          },
        },
      ],
    });

    // Log only after Kafka acknowledges the DLQ publish.
    console.error("[Notification] Message published to DLQ", {
      originalTopic: topic,
      partition,
      offset,
      failureReason,
      dlqTopic: DLQ_TOPIC,
    });
  };

  // Process payment-success events using inbox-based idempotency.
  const processEvent = async (event: PaymentSucceededEvent) => {
    let inboxEvent = await inboxRepository.findByEventId(event.eventId);

    // Skip events that have already completed successfully.
    if (inboxEvent?.status === InboxEventStatus.PROCESSED) {
      console.info("[Notification] Duplicate event skipped", {
        eventId: event.eventId,
      });
      return;
    }

    if (!inboxEvent) {
      try {
        // Create the inbox record to claim this event.
        inboxEvent = await inboxRepository.create({
          eventId: event.eventId,
          eventType: event.eventType,
          status: InboxEventStatus.PROCESSING,
        });
      } catch (error) {
        // P2002 means another delivery may have created the record first.
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

        // Claim a FAILED or stale PROCESSING event when eligible.
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
      // Attempt to recover an existing FAILED or stale PROCESSING event.
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
      // Execute the notification-specific handler.
      await handler.handle(event);

      // Mark the inbox event complete after successful processing.
      await inboxRepository.updateStatus(event.eventId, {
        status: InboxEventStatus.PROCESSED,
        processedAt: new Date(),
        failureReason: null,
      });

      console.info("[Notification] Event processed successfully", {
        eventId: event.eventId,
      });
    } catch (error) {
      // Record the failure to support a later retry.
      const failureReason =
        error instanceof Error ? error.message : "Unknown processing error";

      await inboxRepository.updateStatus(event.eventId, {
        status: InboxEventStatus.FAILED,
        failureReason,
      });

      // Let the failure propagate; do not commit the Kafka offset.
      throw error;
    }
  };

  // Use the shared connection helper, then subscribe to the domain topic.
  const connect = async () => {
    await connectKafka(producer, consumer);

    await consumer.subscribe({
      topic: TOPIC,
      fromBeginning: false,
    });

    console.info("[Notification] Connected and subscribed", {
      topic: TOPIC,
      dlqTopic: DLQ_TOPIC,
      groupId: GROUP_ID,
    });
  };

  // Start processing messages. Event routing remains local to this consumer.
  const start = async () => {
    console.info("[Notification] Starting message processing");

    await consumer.run({
      autoCommit: false,

      eachMessage: async ({ topic, partition, message }) => {
        // Keep the raw payload so invalid messages can be sent to the DLQ.
        const rawValue = message.value?.toString() ?? null;

        let event: DomainEvent | undefined;
        let failureReason: string | null = null;

        if (rawValue === null) {
          failureReason = "Kafka message has no value";
        } else {
          let rawEvent: unknown;

          // Invalid JSON is a malformed message, not a handler failure.
          try {
            rawEvent = JSON.parse(rawValue);
          } catch {
            failureReason = "Kafka message contains invalid JSON";
          }

          // Validate parsed JSON against the shared domain event schema.
          if (failureReason === null) {
            const result = domainEventSchema.safeParse(rawEvent);

            if (!result.success) {
              failureReason = `Invalid domain event: ${result.error.message}`;
            } else {
              event = result.data;
            }
          }
        }

        if (failureReason !== null) {
          // Publish first. If this fails, the original offset is not committed.
          await publishToDlq({
            topic,
            partition,
            offset: message.offset,
            timestamp: message.timestamp,
            key: message.key,
            rawValue,
            failureReason,
          });

          // Commit only after the DLQ publish succeeds.
          await consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (BigInt(message.offset) + 1n).toString(),
            },
          ]);

          return;
        }

        if (!event) {
          throw new Error("Event validation completed without an event");
        }

        console.info("[KAFKA EVENT RECEIVED]", {
          consumer: "notification",
          eventId: event.eventId,
          eventType: event.eventType,
          topic,
          partition,
          offset: message.offset,
        });

        // Route each supported event to its handler.
        switch (event.eventType) {
          case EVENT_TYPES.PAYMENT_SUCCEEDED:
            await processEvent(event);
            break;

          default:
            // Valid but unsupported events are logged and acknowledged.
            console.info("[Notification] Event type not handled", {
              eventId: event.eventId,
              eventType: event.eventType,
            });
            break;
        }

        // Commit only after processing succeeds or a safe skip occurs.
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

  // Reuse the shared helper to close both Kafka connections.
  const disconnect = async () => {
    await disconnectKafka(consumer, producer);
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
