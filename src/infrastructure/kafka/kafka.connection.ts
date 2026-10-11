import type { Consumer, Producer } from "kafkajs";

type KafkaClient = Consumer | Producer;

// Connect the supplied Kafka clients.
export const connectKafka = async (...clients: KafkaClient[]) => {
  await Promise.all(clients.map((client) => client.connect()));
};

// Disconnect all supplied clients, even if one disconnect fails.
export const disconnectKafka = async (...clients: KafkaClient[]) => {
  const results = await Promise.allSettled(
    clients.map((client) => client.disconnect()),
  );

  const failures = results.filter(
    (result) => result.status === "rejected",
  );

  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) =>
        failure.status === "rejected" ? failure.reason : undefined,
      ),
      "Failed to disconnect one or more Kafka clients",
    );
  }
};