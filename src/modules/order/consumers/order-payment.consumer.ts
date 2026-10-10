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
    await consumer.connect();
    await consumer.subscribe({
      topic: TOPIC,
      fromBeginning: false,
    });
  };

  const start = async () => {  await consumer.run({
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

        console.log("[KAFKA EVENT RECEIVED]", {
  consumer: "notification",
  eventId: event.eventId,
  eventType: event.eventType,
});

        if (event.eventType === EVENT_TYPES.PAYMENT_SUCCEEDED) {
          await handler.handle(event);
        }

        // Commit only after processing succeeds.
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

export type OrderPaymentConsumer = ReturnType<typeof createOrderPaymentConsumer>;
