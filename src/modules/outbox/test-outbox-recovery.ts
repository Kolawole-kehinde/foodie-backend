// import crypto from "node:crypto";
// import { prisma } from "../../database/prisma/client.js";
// import { createOutboxDependencies } from "./outbox.container.js";

// const outbox = createOutboxDependencies(prisma);

// const run = async () => {
//   const eventId = crypto.randomUUID();

//   const event = await outbox.outboxRepository.create({
//     eventType: "order.created.v1",
//     aggregateType: "order",
//     aggregateId: "recovery-test",
//     payload: {
//       eventId,
//       eventType: "order.created.v1",
//       occurredAt: new Date().toISOString(),
//       aggregateType: "order",
//       aggregateId: "recovery-test",
//       data: {
//         orderId: "recovery-test",
//         userId: "recovery-test",
//         totalAmount: "1000",
//         items: [],
//       },
//     },
//   });

//   console.log("Created event:", event.id);

//   await prisma.outboxEvent.update({
//     where: {
//       id: event.id,
//     },
//     data: {
//       status: "PROCESSING",
//       processingAt: new Date(Date.now() - 10 * 60 * 1_000),
//     },
//   });

//   console.log("Event marked as stale PROCESSING.");

//   const result =
//     await outbox.outboxPublisherService.publishPendingEvents(1);

//   console.log("\n=== RECOVERY TEST RESULT ===");
//   console.dir(result, { depth: null });

//   const finalEvent =
//     await prisma.outboxEvent.findUnique({
//       where: {
//         id: event.id,
//       },
//     });

//   console.log("\n=== FINAL EVENT ===");
//   console.dir(
//     {
//       status: finalEvent?.status,
//       processingAt: finalEvent?.processingAt,
//       attempts: finalEvent?.attempts,
//       publishedAt: finalEvent?.publishedAt,
//     },
//     { depth: null },
//   );

//   await prisma.$disconnect();
// };

// void run();

// pnpm exec tsx src/modules/outbox/test-outbox-recovery.ts