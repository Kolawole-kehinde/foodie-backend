
import type { Consumer, Producer } from "kafkajs";
import { kafka } from "../../../infrastructure/kafka/kafka.client.js";
import {
  connectKafka,
  disconnectKafka,
} from "../../../infrastructure/kafka/kafka.connection.js";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import { EVENT_TYPES } from "../../../shared/events/event.types.js";
import type { PaymentSucceededHandler } from "../../payments/handlers/payment-succeeded.handler.js";

type OrderPaymentConsumerDependencies = {
  handler: PaymentSucceededHandler;
  topic?: string;
  groupId?: string;
};

type PublishToDlqInput = {
  topic: string;
  partition: number;
  offset: string;
  timestamp: string;
  key: Buffer | null;
  rawValue: string | null;
  failureReason: string;
};

const DLQ_TOPIC = "domain-events.dlq";

// Maximum number of handler attempts, including the first attempt.
const MAX_HANDLER_ATTEMPTS = 3;

// Exponential backoff: 1 second, then 2 seconds.
const getRetryDelay = (attempt: number) =>
  1000 * 2 ** (attempt - 1);

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export const createOrderPaymentConsumer = ({
  handler,
  topic = "domain-events",
  groupId = "foodie-order-consumer",
}: OrderPaymentConsumerDependencies) => {
  const consumer: Consumer = kafka.consumer({ groupId });
  const producer: Producer = kafka.producer();

  // Publish a failed message to the DLQ before committing its offset.
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
          // Use the original coordinates as a stable deduplication key.
          key: `${topic}:${partition}:${offset}`,
          value: JSON.stringify({
            originalMessage: rawValue,
            originalKey: key?.toString() ?? null,
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

    console.warn("[ORDER CONSUMER] Message published to DLQ", {
      originalTopic: topic,
      partition,
      offset,
      failureReason,
      dlqTopic: DLQ_TOPIC,
    });
  };

  // Connect both Kafka clients and subscribe to the configured topic.
  const connect = async () => {
    console.log("[ORDER CONSUMER] Connecting...", {
      topic,
      dlqTopic: DLQ_TOPIC,
      groupId,
    });

    await connectKafka(producer, consumer);

    await consumer.subscribe({
      topic,
      fromBeginning: false,
    });

    console.log("[ORDER CONSUMER] Connected and subscribed", {
      topic,
      dlqTopic: DLQ_TOPIC,
      groupId,
    });
  };

  // Consume messages with explicit offset commits.
  const start = async () => {
    console.log("[ORDER CONSUMER] Starting message processing...");

    await consumer.run({
      autoCommit: false,

      eachMessage: async ({ topic: messageTopic, partition, message }) => {
        const offsetToCommit = (BigInt(message.offset) + 1n).toString();
        const rawValue = message.value?.toString() ?? null;

        console.log("[ORDER CONSUMER] Raw message received", {
          topic: messageTopic,
          partition,
          offset: message.offset,
          hasValue: rawValue !== null,
        });

        let event: ReturnType<typeof domainEventSchema.parse>;

        // Validate the message before attempting business processing.
        try {
          if (rawValue === null) {
            throw new Error("Kafka message has no value");
          }

          const rawEvent: unknown = JSON.parse(rawValue);
          const result = domainEventSchema.safeParse(rawEvent);

          if (!result.success) {
            throw new Error(
              `Invalid domain event: ${result.error.message}`,
            );
          }

          event = result.data;
        } catch (error) {
          const failureReason =
            error instanceof Error ? error.message : String(error);

          console.error("[ORDER CONSUMER] Invalid message", {
            topic: messageTopic,
            partition,
            offset: message.offset,
            failureReason,
          });

          // If DLQ publishing fails, this offset is not committed.
          await publishToDlq({
            topic: messageTopic,
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
              topic: messageTopic,
              partition,
              offset: offsetToCommit,
            },
          ]);

          console.log("[ORDER CONSUMER] Invalid message offset committed", {
            topic: messageTopic,
            partition,
            offset: offsetToCommit,
          });

          return;
        }

        console.log("[KAFKA EVENT RECEIVED]", {
          consumer: "order",
          eventId: event.eventId,
          eventType: event.eventType,
          topic: messageTopic,
          partition,
          offset: message.offset,
        });

        // Handle payment success with bounded retries.
        if (event.eventType === EVENT_TYPES.PAYMENT_SUCCEEDED) {
          console.log("[ORDER CONSUMER] Handling payment success", {
            eventId: event.eventId,
          });

          let handlerSucceeded = false;
          let lastError: unknown;

          // Retry the handler up to MAX_HANDLER_ATTEMPTS times.
          for (
            let attempt = 1;
            attempt <= MAX_HANDLER_ATTEMPTS;
            attempt++
          ) {
            try {
              await handler.handle(event);
              handlerSucceeded = true;

              console.log("[ORDER CONSUMER] Payment success handled", {
                eventId: event.eventId,
                attempt,
              });

              break;
            } catch (error) {
              lastError = error;

              console.error("[ORDER CONSUMER] Handler attempt failed", {
                eventId: event.eventId,
                attempt,
                maxAttempts: MAX_HANDLER_ATTEMPTS,
                error:
                  error instanceof Error ? error.message : String(error),
              });

              // Wait before retrying, but not after the final failure.
              if (attempt < MAX_HANDLER_ATTEMPTS) {
                await sleep(getRetryDelay(attempt));
              }
            }
          }

          // After exhausting retries, publish the valid event to the DLQ.
          if (!handlerSucceeded) {
            const failureReason =
              lastError instanceof Error
                ? lastError.message
                : String(lastError);

            await publishToDlq({
              topic: messageTopic,
              partition,
              offset: message.offset,
              timestamp: message.timestamp,
              key: message.key,
              rawValue,
              failureReason:
                `Handler failed after ${MAX_HANDLER_ATTEMPTS} attempts: ${failureReason}`,
            });

            console.warn(
              "[ORDER CONSUMER] Handler retries exhausted; DLQ published",
              {
                eventId: event.eventId,
                attempts: MAX_HANDLER_ATTEMPTS,
              },
            );
          }
        }

        // Commit after handler success, successful DLQ publishing,
        // or validation of a supported but unhandled event type.
        await consumer.commitOffsets([
          {
            topic: messageTopic,
            partition,
            offset: offsetToCommit,
          },
        ]);

        console.log("[ORDER CONSUMER] Offset committed", {
          topic: messageTopic,
          partition,
          offset: offsetToCommit,
        });
      },
    });
  };

  // Disconnect both Kafka clients.
  const disconnect = async () => {
    console.log("[ORDER CONSUMER] Disconnecting...");
    await disconnectKafka(consumer, producer);
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
