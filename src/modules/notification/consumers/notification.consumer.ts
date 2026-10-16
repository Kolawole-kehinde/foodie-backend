import type { Consumer } from "kafkajs";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { kafka } from "../../../infrastructure/kafka/kafka.client.js";
import {
  connectKafka,
  disconnectKafka,
} from "../../../infrastructure/kafka/kafka.connection.js";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import type { DomainEvent } from "../../../shared/events/event.types.js";

import type { OrderNotificationHandler } from "../handlers/order-notification.handler.js";
import type { PaymentNotificationHandler } from "../handlers/payment-notification.handler.js";
import { isSupportedNotificationEvent } from "../constants/supported-notification-events.constant.js";
import { createNotificationDlqPublisher } from "./notification-dlq.publisher.js";
import { createNotificationEventProcessor } from "./notification-event.processor.js";
import { createNotificationEventRouter } from "./notification-event.router.js";

type NotificationConsumerDependencies = {
  db: DatabaseClient;
  handler: PaymentNotificationHandler;
  orderNotificationHandler: OrderNotificationHandler;
};

const TOPIC = "domain-events";
const DLQ_TOPIC = "domain-events.dlq";
const GROUP_ID = "foodie-notification-consumer";

export const createNotificationConsumer = ({
  db,
  handler,
  orderNotificationHandler,
}: NotificationConsumerDependencies) => {
  const consumer: Consumer = kafka.consumer({
    groupId: GROUP_ID,
  });

  const producer = kafka.producer();

  const router = createNotificationEventRouter({
    paymentHandler: handler,
    orderHandler: orderNotificationHandler,
  });

  const processor = createNotificationEventProcessor({
    db,
    router,
  });

  const dlqPublisher = createNotificationDlqPublisher({
    producer,
  });

  const commitOffset = async (
    topic: string,
    partition: number,
    offset: string,
  ) => {
    await consumer.commitOffsets([
      {
        topic,
        partition,
        offset: (BigInt(offset) + 1n).toString(),
      },
    ]);
  };

  const publishToDlqAndCommit = async ({
    topic,
    partition,
    message,
    rawValue,
    failureReason,
  }: {
    topic: string;
    partition: number;
    message: {
      offset: string;
      timestamp: string;
      key: Buffer | null;
    };
    rawValue: string | null;
    failureReason: string;
  }) => {
    await dlqPublisher.publish({
      topic,
      partition,
      offset: message.offset,
      timestamp: message.timestamp,
      key: message.key,
      rawValue,
      failureReason,
    });

    // Commit only after DLQ publication succeeds.
    await commitOffset(topic, partition, message.offset);
  };

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

  const start = async () => {
    console.info("[Notification] Starting message processing");

    await consumer.run({
      autoCommit: false,

      eachMessage: async ({ topic, partition, message }) => {
        const rawValue = message.value?.toString() ?? null;

        let event: DomainEvent | undefined;
        let failureReason: string | null = null;

        if (rawValue === null) {
          failureReason = "Kafka message has no value";
        } else {
          let rawEvent: unknown;

          try {
            rawEvent = JSON.parse(rawValue);
          } catch {
            failureReason = "Kafka message contains invalid JSON";
          }

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
          await publishToDlqAndCommit({
            topic,
            partition,
            message,
            rawValue,
            failureReason,
          });

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

        if (!isSupportedNotificationEvent(event)) {
          const eventType = (event as { eventType: string }).eventType;

          await publishToDlqAndCommit({
            topic,
            partition,
            message,
            rawValue,
            failureReason: `Unsupported notification event type: ${eventType}`,
          });

          return;
        }
        await processor.process(event);

        // Do not commit if processing throws.
        await commitOffset(topic, partition, message.offset);
      },
    });
  };

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
