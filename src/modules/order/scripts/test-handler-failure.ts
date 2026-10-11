
import { createOrderPaymentConsumer } from "../consumers/order-payment.consumer.js";
import type { PaymentSucceededHandler } from "../../payments/handlers/payment-succeeded.handler.js";

const handler: PaymentSucceededHandler = {
  handle: async () => {
    console.log("[TEST] Simulating payment handler failure...");
    throw new Error("SIMULATED_HANDLER_FAILURE");
  },
};

const consumer = createOrderPaymentConsumer({
  handler,
  topic: "order-handler-failure-test",
  groupId: "order-handler-failure-test-group",
});

let shuttingDown = false;

const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("[TEST] Shutting down test consumer...");
  try {
    await consumer.disconnect();
    process.exitCode = 0;
  } catch (error) {
    console.error("[TEST] Disconnect failed:", error);
    process.exitCode = 1;
  }
};

process.once("SIGINT", () => {
  void shutdown();
});

const main = async () => {
  try {
    await consumer.connect();
    console.log("[TEST] Consumer connected and subscribed.");
    await consumer.start();
  } catch (error) {
    console.error("[TEST] Consumer stopped with error:", error);
    process.exitCode = 1;
    await shutdown();
  }
};

void main();
