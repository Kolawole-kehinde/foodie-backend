
import { Kafka, type Consumer } from "kafkajs";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { PaymentSucceededHandler } from "../../payments/handlers/payment-succeeded.handler.js";

type OrderPaymentConsumerDependencies = {
  brokers?: string[];
  handler: PaymentSucceededHandler;
};

const TOPIC = "domain-events";
const GROUP_ID = "foodie-order-consumer";

export const createOrderPaymentConsumer = ({
  brokers = ["localhost:9092"],
  handler,
}: OrderPaymentConsumerDependencies) => {
  const kafka = new Kafka({
    clientId: "foodie-order-service",
    brokers,
  });

  const consumer: Consumer = kafka.consumer({
    groupId: GROUP_ID,
  });

  const connect = async () => {
    console.log("[ORDER CONSUMER] Connecting...", {
      brokers,
      topic: TOPIC,
      groupId: GROUP_ID,
    });

    await consumer.connect();

    await consumer.subscribe({
      topic: TOPIC,
      fromBeginning: false,
    });

    console.log("[ORDER CONSUMER] Connected and subscribed", {
      topic: TOPIC,
      groupId: GROUP_ID,
    });
  };

  const start = async () => {
    console.log("[ORDER CONSUMER] Starting message processing...");

    await consumer.run({
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

          const rawEvent: unknown = JSON.parse(
            message.value.toString(),
          );

          const result = domainEventSchema.safeParse(rawEvent);

          if (!result.success) {
            throw new Error(
              `Invalid domain event: ${result.error.message}`,
            );
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

          if (event.eventType === EVENT_TYPES.PAYMENT_SUCCEEDED) {
            console.log("[ORDER CONSUMER] Handling payment success", {
              eventId: event.eventId,
            });

            await handler.handle(event);

            console.log("[ORDER CONSUMER] Payment success handled", {
              eventId: event.eventId,
            });
          }

          // Commit only after processing succeeds.
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
          console.error("[ORDER CONSUMER] Message processing failed", {
            topic,
            partition,
            offset: message.offset,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          });

          throw error;
        }
      },
    });
  };

  const disconnect = async () => {
    console.log("[ORDER CONSUMER] Disconnecting...");
    await consumer.disconnect();
  };

  return { connect, start, disconnect };
};

export type OrderPaymentConsumer = ReturnType<
  typeof createOrderPaymentConsumer
>;
