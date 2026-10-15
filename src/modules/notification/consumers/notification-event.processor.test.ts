
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InboxEventStatus, Prisma } from "@prisma/client";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import type { DomainEvent } from "../../../shared/events/event.types.js";
import type { NotificationEventRouter } from "./notification-event.router.js";
import { createNotificationEventProcessor } from "./notification-event.processor.js";

const createDatabaseMock = () => ({
  inboxEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
});

const createEvent = (): DomainEvent =>
  ({
    eventId: "event-123",
    eventType: "test.event",
  }) as DomainEvent;

const createInboxRecord = (
  status: InboxEventStatus = InboxEventStatus.PROCESSING,
) =>
  ({
    id: "inbox-123",
    eventId: "event-123",
    eventType: "test.event",
    status,
    claimToken: null,
    leaseExpiresAt: null,
    receivedAt: new Date(),
    processedAt: null,
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }) as const;

const createUniqueConstraintError = () =>
  new Prisma.PrismaClientKnownRequestError(
    "Unique constraint failed",
    {
      code: "P2002",
      clientVersion: "test",
    },
  );

describe("createNotificationEventProcessor", () => {
  let db: ReturnType<typeof createDatabaseMock>;
  let route: ReturnType<typeof vi.fn>;
  let processor: ReturnType<typeof createNotificationEventProcessor>;
  let event: DomainEvent;

  beforeEach(() => {
    vi.restoreAllMocks();

    db = createDatabaseMock();
    route = vi.fn().mockResolvedValue(undefined);
    event = createEvent();

    processor = createNotificationEventProcessor({
      db: db as unknown as DatabaseClient,
      router: { route } as unknown as NotificationEventRouter,
    });

    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    db.inboxEvent.findUnique.mockResolvedValue(null);
    db.inboxEvent.create.mockResolvedValue(createInboxRecord());
    db.inboxEvent.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates an inbox record and processes a new event", async () => {
    await processor.process(event);

    expect(db.inboxEvent.findUnique).toHaveBeenCalledWith({
      where: { eventId: event.eventId },
    });

    expect(db.inboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: event.eventId,
        eventType: event.eventType,
        status: InboxEventStatus.PROCESSING,
        claimToken: expect.any(String),
        leaseExpiresAt: expect.any(Date),
      }),
    });

    expect(route).toHaveBeenCalledWith(event);
    expect(db.inboxEvent.updateMany).toHaveBeenCalledTimes(1);

    const [query] = db.inboxEvent.updateMany.mock.calls[0];

    expect(query.where).toMatchObject({
      eventId: event.eventId,
      status: InboxEventStatus.PROCESSING,
      claimToken: expect.any(String),
      leaseExpiresAt: { gt: expect.any(Date) },
    });

    expect(query.data).toMatchObject({
      status: InboxEventStatus.PROCESSED,
      claimToken: null,
      leaseExpiresAt: null,
    });
  });

  it("skips an event that has already been processed", async () => {
    db.inboxEvent.findUnique.mockResolvedValue(
      createInboxRecord(InboxEventStatus.PROCESSED),
    );

    await processor.process(event);

    expect(route).not.toHaveBeenCalled();
    expect(db.inboxEvent.create).not.toHaveBeenCalled();
    expect(db.inboxEvent.updateMany).not.toHaveBeenCalled();
  });

  it("does not process an event when another worker owns its lease", async () => {
    db.inboxEvent.findUnique.mockResolvedValue(
      createInboxRecord(InboxEventStatus.PROCESSING),
    );
    db.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

    await expect(processor.process(event)).rejects.toThrow(
      `Notification event is already claimed: ${event.eventId}`,
    );

    expect(route).not.toHaveBeenCalled();
  });

  it("reclaims a failed event and processes it", async () => {
    db.inboxEvent.findUnique.mockResolvedValue(
      createInboxRecord(InboxEventStatus.FAILED),
    );

    await processor.process(event);

    expect(db.inboxEvent.updateMany).toHaveBeenCalledTimes(2);
    expect(route).toHaveBeenCalledWith(event);
  });

  it("marks the event as failed when routing throws", async () => {
    const processingError = new Error("Notification handler failed");
    route.mockRejectedValue(processingError);

    await expect(processor.process(event)).rejects.toThrow(
      "Notification handler failed",
    );

    expect(db.inboxEvent.updateMany).toHaveBeenCalledTimes(1);

    const [query] = db.inboxEvent.updateMany.mock.calls[0];

    expect(query.where).toMatchObject({
      eventId: event.eventId,
      status: InboxEventStatus.PROCESSING,
      claimToken: expect.any(String),
    });

    expect(query.data).toMatchObject({
      status: InboxEventStatus.FAILED,
      failureReason: "Notification handler failed",
      claimToken: null,
      leaseExpiresAt: null,
    });
  });

  it("throws when the event cannot be marked as processed", async () => {
    db.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

    await expect(processor.process(event)).rejects.toThrow(
      `Cannot complete notification event without a valid lease: ${event.eventId}`,
    );

    expect(route).toHaveBeenCalledWith(event);
  });

  it("recovers when another worker inserts the event concurrently", async () => {
    db.inboxEvent.create.mockRejectedValue(createUniqueConstraintError());

    db.inboxEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createInboxRecord(InboxEventStatus.FAILED));

    await processor.process(event);

    expect(db.inboxEvent.findUnique).toHaveBeenCalledTimes(2);
    expect(db.inboxEvent.updateMany).toHaveBeenCalledTimes(2);
    expect(route).toHaveBeenCalledWith(event);
  });

  it("throws when a concurrent insert cannot be claimed", async () => {
    db.inboxEvent.create.mockRejectedValue(createUniqueConstraintError());

    db.inboxEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createInboxRecord(InboxEventStatus.PROCESSING));

    db.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

    await expect(processor.process(event)).rejects.toThrow(
      `Notification event is already claimed: ${event.eventId}`,
    );

    expect(route).not.toHaveBeenCalled();
  });

  it("does not process when a concurrent insert is already processed", async () => {
    db.inboxEvent.create.mockRejectedValue(createUniqueConstraintError());

    db.inboxEvent.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createInboxRecord(InboxEventStatus.PROCESSED));

    await processor.process(event);

    expect(route).not.toHaveBeenCalled();
    expect(db.inboxEvent.updateMany).not.toHaveBeenCalled();
  });

  it("rethrows a non-unique database error during inbox creation", async () => {
    db.inboxEvent.create.mockRejectedValue(
      new Error("Database unavailable"),
    );

    await expect(processor.process(event)).rejects.toThrow(
      "Database unavailable",
    );

    expect(route).not.toHaveBeenCalled();
  });
  
it("marks processing as failed when lease renewal returns false", async () => {
  vi.useFakeTimers();

  let finishRouting!: () => void;

  route.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishRouting = resolve;
      }),
  );

  db.inboxEvent.findUnique.mockResolvedValue(null);
  db.inboxEvent.create.mockResolvedValue(createInboxRecord());

  const processing = processor.process(event);

  // Allow the processor to start routing.
  await vi.waitFor(() => {
    expect(route).toHaveBeenCalledWith(event);
  });

  // The first renewal should happen after 20 seconds.
  db.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

  await vi.advanceTimersByTimeAsync(20_000);

  finishRouting();

  await expect(processing).rejects.toThrow(
    `Notification processing lease was lost: ${event.eventId}`,
  );
});

it("marks processing as failed when lease renewal throws", async () => {
  vi.useFakeTimers();

  let finishRouting!: () => void;

  route.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finishRouting = resolve;
      }),
  );

  const processing = processor.process(event);

  await vi.waitFor(() => {
    expect(route).toHaveBeenCalledWith(event);
  });

  db.inboxEvent.updateMany.mockRejectedValue(
    new Error("Database unavailable"),
  );

  await vi.advanceTimersByTimeAsync(20_000);

  finishRouting();

  await expect(processing).rejects.toThrow(
    `Notification processing lease was lost: ${event.eventId}`,
  );
});

});
