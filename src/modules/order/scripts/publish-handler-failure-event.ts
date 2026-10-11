
import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "order-handler-failure-test-producer",
  brokers: ["localhost:9092"],
});

const producer = kafka.producer();

const main = async () => {
  await producer.connect();

  try {
    const event = {
      eventId: "test-handler-failure-001",
      eventType: "payment.succeeded.v1",
      occurredAt: new Date().toISOString(),
      aggregateType: "payment",
      aggregateId: "test-payment-001",
      data: {
        paymentId: "test-payment-001",
        orderId: "test-order-001",
        userId: "test-user-001",
        provider: "test-provider",
        providerReference: "test-reference-001",
        amount: "1000.00",
        currency: "NGN",
        status: "SUCCESS",
      },
    };

    await producer.send({
      topic: "order-handler-failure-test",
      messages: [
        {
          key: "test-handler-failure-001",
          value: JSON.stringify(event),
        },
      ],
    });

    console.log("[TEST] Valid payment event published.");
  } finally {
    await producer.disconnect();
  }
};

main().catch((error) => {
  console.error("[TEST] Failed to publish event:", error);
  process.exitCode = 1;
});
