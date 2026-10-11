import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "foodie-dlq-inspector",
  brokers: ["localhost:9092"],
});

const consumer = kafka.consumer({
  groupId: `foodie-dlq-inspector-${Date.now()}`,
});

const main = async () => {
  await consumer.connect();

  try {
    await consumer.subscribe({
      topic: "domain-events.dlq",
      fromBeginning: true,
    });

    await consumer.run({
      eachMessage: async ({ message, partition, topic }) => {
        console.info("[DLQ INSPECTOR] Message received", {
          topic,
          partition,
          offset: message.offset,
          key: message.key?.toString() ?? null,
          value: message.value?.toString() ?? null,
          headers: message.headers,
        });

        // Stop after inspecting one record.
        await consumer.stop();
      },
    });
  } catch (error) {
    await consumer.disconnect();
    throw error;
  }
};

main().catch((error) => {
  console.error("DLQ inspection failed:", error);
  process.exitCode = 1;
});