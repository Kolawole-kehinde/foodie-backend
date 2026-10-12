
import type { Consumer } from "kafkajs";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { kafka } from "../../../infrastructure/kafka/kafka.client.js";
import {
  connectKafka,
  disconnectKafka,
} from "../../../infrastructure/kafka/kafka.connection.js";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type {
  DomainEvent,
  OrderEvent,
  PaymentSucceededEvent,
} from "../../../shared/events/event.types.js";

import type { PaymentSucceededNotificationHandler } from "../handlers/payment-succeeded-notification.handler.js";
import type { OrderNotificationHandler } from "../handlers/order-notification.handler.js";

import { createNotificationEventRouter } from "./notification-event.router.js";
import { createNotificationEventProcessor } from "./notification-event.processor.js";
import { createNotificationDlqPublisher } from "./notification-dlq.publisher.js";

type SupportedNotificationEvent = OrderEvent | PaymentSucceededEvent;

type NotificationConsumerDependencies = {
  db: DatabaseClient;
  handler: PaymentSucceededNotificationHandler;
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
    paymentSucceededHandler: handler,
    orderHandler: orderNotificationHandler,
  });

  const processor = createNotificationEventProcessor({
    db,
    router,
  });

  const dlqPublisher = createNotificationDlqPublisher({
    producer,
  });

  const isSupportedEvent = (
    event: DomainEvent,
  ): event is SupportedNotificationEvent => {
    switch (event.eventType) {
      case EVENT_TYPES.PAYMENT_SUCCEEDED:
      case EVENT_TYPES.ORDER_CREATED:
      case EVENT_TYPES.ORDER_CONFIRMED:
      case EVENT_TYPES.ORDER_PROCESSING:
      case EVENT_TYPES.ORDER_SHIPPED:
      case EVENT_TYPES.ORDER_DELIVERED:
      case EVENT_TYPES.ORDER_CANCELLED:
      case EVENT_TYPES.ORDER_EXPIRED:
        return true;

      default:
        return false;
    }
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
          await dlqPublisher.publish({
            topic,
            partition,
            offset: message.offset,
            timestamp: message.timestamp,
            key: message.key,
            rawValue,
            failureReason,
          });

          // Acknowledge only after the DLQ publication succeeds.
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

        if (isSupportedEvent(event)) {
          await processor.process(event);
        } else {
          // Preserve existing behavior for valid but unsupported events.
          console.info("[Notification] Event type not handled", {
            eventId: event.eventId,
            eventType: event.eventType,
          });
        }

        // Commit only after processing succeeds or the event is safely skipped.
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
