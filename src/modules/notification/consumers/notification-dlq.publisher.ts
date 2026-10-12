
import type { Producer } from "kafkajs";

import type { PublishToDlqInput } from "../types/dlq.types.js";

const DLQ_TOPIC = "domain-events.dlq";

type NotificationDlqPublisherDependencies = {
  producer: Producer;
};

export const createNotificationDlqPublisher = ({
  producer,
}: NotificationDlqPublisherDependencies) => {
  const publish = async ({
    topic,
    partition,
    offset,
    timestamp,
    key,
    rawValue,
    failureReason,
  }: PublishToDlqInput): Promise<void> => {
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

    // Log only after Kafka acknowledges the DLQ publication.
    console.error("[Notification] Message published to DLQ", {
      originalTopic: topic,
      partition,
      offset,
      failureReason,
      dlqTopic: DLQ_TOPIC,
    });
  };

  return { publish };
};

export type NotificationDlqPublisher = ReturnType<
  typeof createNotificationDlqPublisher
>;
