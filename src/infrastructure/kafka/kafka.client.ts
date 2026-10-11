import { Kafka } from "kafkajs";

export const kafka = new Kafka({
  clientId: "foodie-backend",
  brokers: ["localhost:9092"],
});