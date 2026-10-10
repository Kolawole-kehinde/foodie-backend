
import { Kafka, type Producer } from "kafkajs";
import { domainEventSchema } from "../../../shared/events/event.schema.js";
import type { EventPublisher, PublishEventInput} from "./event-publisher.js";

type KafkaEventPublisherDependencies = {
  brokers: string[];
  clientId?: string;
};


export const createKafkaEventPublisher = ({
  brokers,
  clientId = "foodie-backend",
}: KafkaEventPublisherDependencies): EventPublisher & {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  
} => {
  const kafka = new Kafka({
    clientId,
    brokers,
  });

  const producer: Producer = kafka.producer({
    allowAutoTopicCreation: false,
  });

  const connect = async () => {
    await producer.connect();
  };

  const disconnect = async () => {
    await producer.disconnect();
  };

  const publish = async ({
    eventId,
    eventType,
    payload,
  }: PublishEventInput) => {
    const result = domainEventSchema.safeParse(payload);

    if (!result.success) {
      throw new Error(
        `Invalid domain event payload for ${eventType}: ${eventId}. ${result.error.message}`,
      );
    }

    const event = result.data;

    if (
      event.eventId !== eventId ||
      event.eventType !== eventType
    ) {
      throw new Error(`Event metadata mismatch for event: ${eventId}`);
    }

    await producer.send({
      topic: "domain-events",
      acks: -1,
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify(event),
          headers: {
            eventId: event.eventId,
            eventType: event.eventType,
          },
        },
      ],
    });

    console.log("[KAFKA EVENT PUBLISHED]", {
      eventId,
      eventType,
      aggregateId: event.aggregateId,
    });
  };

  return {
    connect,
    disconnect,
    publish,
  };
};
