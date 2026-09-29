// import crypto from "node:crypto";

// import { prisma } from "../../database/prisma/client.js";
// import { createOutboxDependencies } from "./outbox.container.js";

// const outbox = createOutboxDependencies(prisma);

// const run = async () => {
//   const event = await outbox.outboxRepository.create({
//     eventType: "order.created.v1",
//     aggregateType: "order",
//     aggregateId: "concurrency-test",
//     payload: {
//       eventId: crypto.randomUUID(),
//       eventType: "order.created.v1",
//       occurredAt: new Date().toISOString(),
//       aggregateType: "order",
//       aggregateId: "concurrency-test",
//       data: {
//         orderId: "concurrency-test",
//         userId: "concurrency-test",
//         totalAmount: "1000",
//         items: [],
//       },
//     },
//   });

//   console.log("Created test event:", event.id);

//   const results = await Promise.all([
//     outbox.outboxPublisherService.publishPendingEvents(1),
//     outbox.outboxPublisherService.publishPendingEvents(1),
//   ]);

//   console.log("\n=== CONCURRENCY TEST RESULTS ===");
//   console.dir(results, { depth: null });

//   await prisma.$disconnect();
// };

// void run();


// pnpm exec tsx src/modules/outbox/test-outbox-concurrency.ts