import type { Consumer } from "kafkajs";
import { kafka } from "../../../infrastructure/kafka/kafka.client.js";
import {
  connectKafka,
  disconnectKafka,
} from "../../../infrastructure/kafka/kafka.connection.js";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { PaymentSucceededHandler } from "../../payments/handlers/payment-succeeded.handler.js";

// The order consumer requires its event handler.
type OrderPaymentConsumerDependencies = {
  handler: PaymentSucceededHandler;
};

const TOPIC = "domain-events";
const GROUP_ID = "foodie-order-consumer";

export const createOrderPaymentConsumer = ({
  handler,
}: OrderPaymentConsumerDependencies) => {
  
  // Create a consumer using the shared Kafka client.
  const consumer: Consumer = kafka.consumer({
    groupId: GROUP_ID,
  });

  // Connect through the shared helper and subscribe to domain events.
  const connect = async () => {
    console.log("[ORDER CONSUMER] Connecting...", {
      topic: TOPIC,
      groupId: GROUP_ID,
    });

    await connectKafka(consumer);

    await consumer.subscribe({
      topic: TOPIC,
      fromBeginning: false,
    });

    console.log("[ORDER CONSUMER] Connected and subscribed", {
      topic: TOPIC,
      groupId: GROUP_ID,
    });
  };

  // Start consuming and processing payment-success events.
  const start = async () => {
    console.log("[ORDER CONSUMER] Starting message processing...");

    await consumer.run({
      // Offsets are committed explicitly after successful processing.
      autoCommit: false,

      eachMessage: async ({ topic, partition, message }) => {
        console.log("[ORDER CONSUMER] Raw message received", {
          topic,
          partition,
          offset: message.offset,
          hasValue: message.value !== null,
        });

        try {
          if (!message.value) {
            throw new Error("Kafka message has no value");
          }

          // Parse the payload and validate the domain event structure.
          const rawEvent: unknown = JSON.parse(message.value.toString());
          const result = domainEventSchema.safeParse(rawEvent);

          if (!result.success) {
            throw new Error(`Invalid domain event: ${result.error.message}`);
          }

          const event = result.data;

          console.log("[KAFKA EVENT RECEIVED]", {
            consumer: "order",
            eventId: event.eventId,
            eventType: event.eventType,
            topic,
            partition,
            offset: message.offset,
          });

          // Handle payment-success events; other valid event types are ignored.
          if (event.eventType === EVENT_TYPES.PAYMENT_SUCCEEDED) {
            console.log("[ORDER CONSUMER] Handling payment success", {
              eventId: event.eventId,
            });

            await handler.handle(event);

            console.log("[ORDER CONSUMER] Payment success handled", {
              eventId: event.eventId,
            });
          }

          // Commit only after the applicable handler succeeds.
          await consumer.commitOffsets([
            {
              topic,
              partition,
              offset: (BigInt(message.offset) + 1n).toString(),
            },
          ]);

          console.log("[ORDER CONSUMER] Offset committed", {
            topic,
            partition,
            offset: (BigInt(message.offset) + 1n).toString(),
          });
        } catch (error) {
          // Keep the offset uncommitted so the message can be retried.
          console.error("[ORDER CONSUMER] Message processing failed", {
            topic,
            partition,
            offset: message.offset,
            error: error instanceof Error ? error.message : String(error),
          });

          throw error;
        }
      },
    });
  };

  // Disconnect using the shared Kafka connection helper.
  const disconnect = async () => {
    console.log("[ORDER CONSUMER] Disconnecting...");
    await disconnectKafka(consumer);
  };

  return {
    connect,
    start,
    disconnect,
  };
};

export type OrderPaymentConsumer = ReturnType<
  typeof createOrderPaymentConsumer
>;
