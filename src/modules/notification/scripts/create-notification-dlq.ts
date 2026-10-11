import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "foodie-notification-admin",
  brokers: ["localhost:9092"],
});

const admin = kafka.admin();

const main = async () => {
  await admin.connect();

  try {
    await admin.createTopics({
      waitForLeaders: true,
      topics: [
        {
          topic: "domain-events.dlq",
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
    });

    console.info("Notification DLQ topic created or already exists.");
  } finally {
    await admin.disconnect();
  }
};

main().catch((error) => {
  console.error("Failed to create notification DLQ topic:", error);
  process.exitCode = 1;
});