
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "foodie-dlq-test-producer",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

const main = async () => {
  await producer.connect();

  try {
    await producer.send({
      topic: "domain-events",
      messages: [
        {
          key: "dlq-test-malformed-001",
          value: "{ invalid json",
        },
      ],
    });

    console.info("Malformed test message published.");
  } finally {
    await producer.disconnect();
  }
};

main().catch((error) => {
  console.error("Failed to publish test message:", error);
  process.exitCode = 1;
});