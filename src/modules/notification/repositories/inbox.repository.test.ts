
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "../../../database/prisma/types.js";
import { createInboxRepository } from "./inbox.repository.js";

const createDatabaseMock = () => ({
  inboxEvent: {
    findUnique: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    update: vi.fn(),
  },
});

describe("createInboxRepository", () => {
  let db: ReturnType<typeof createDatabaseMock>;
  let repository: ReturnType<typeof createInboxRepository>;

  beforeEach(() => {
    db = createDatabaseMock();

    repository = createInboxRepository(
      db as unknown as DatabaseClient,
    );
  });

  describe("claimForProcessing", () => {
    it("claims an event using a new token and lease", async () => {
      db.inboxEvent.updateMany.mockResolvedValue({ count: 1 });

      const claimed = await repository.claimForProcessing(
        "event-123",
        "claim-token-new",
        60_000,
      );

      expect(claimed).toBe(true);

      const [query] = db.inboxEvent.updateMany.mock.calls[0]!;

      expect(query.where).toMatchObject({
        eventId: "event-123",
        OR: [
          { status: "FAILED" },
          {
            status: "PROCESSING",
            leaseExpiresAt: { lte: expect.any(Date) },
          },
        ],
      });

      expect(query.data).toMatchObject({
        status: "PROCESSING",
        claimToken: "claim-token-new",
        leaseExpiresAt: expect.any(Date),
        processedAt: null,
        failureReason: null,
      });

      expect(
        query.data.leaseExpiresAt.getTime(),
      ).toBeGreaterThan(Date.now());
    });

    it("returns false when another worker owns the active lease", async () => {
      db.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

      const claimed = await repository.claimForProcessing(
        "event-123",
        "claim-token-new",
        60_000,
      );

      expect(claimed).toBe(false);
    });
  });

  describe("renewLease", () => {
    it("renews a lease only for the current, unexpired claim", async () => {
      db.inboxEvent.updateMany.mockResolvedValue({ count: 1 });

      const renewed = await repository.renewLease(
        "event-123",
        "claim-token-current",
        60_000,
      );

      expect(renewed).toBe(true);

     const [query] = db.inboxEvent.updateMany.mock.calls[0]!;

      expect(query.where).toMatchObject({
        eventId: "event-123",
        status: "PROCESSING",
        claimToken: "claim-token-current",
        leaseExpiresAt: { gt: expect.any(Date) },
      });

      expect(query.data.leaseExpiresAt).toBeInstanceOf(Date);
    });

    it("returns false when the claim token is stale", async () => {
      db.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

      const renewed = await repository.renewLease(
        "event-123",
        "claim-token-old",
        60_000,
      );

      expect(renewed).toBe(false);
    });
  });

  describe("markProcessed", () => {
    it("completes the event only for the current valid claim", async () => {
      db.inboxEvent.updateMany.mockResolvedValue({ count: 1 });

      const processed = await repository.markProcessed(
        "event-123",
        "claim-token-current",
      );

      expect(processed).toBe(true);

      const [query] = db.inboxEvent.updateMany.mock.calls[0]!;

      expect(query.where).toMatchObject({
        eventId: "event-123",
        status: "PROCESSING",
        claimToken: "claim-token-current",
        leaseExpiresAt: { gt: expect.any(Date) },
      });

      expect(query.data).toMatchObject({
        status: "PROCESSED",
        failureReason: null,
        claimToken: null,
        leaseExpiresAt: null,
      });

      expect(query.data.processedAt).toBeInstanceOf(Date);
    });

    it("rejects completion when the claim is no longer valid", async () => {
      db.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

      const processed = await repository.markProcessed(
        "event-123",
        "claim-token-old",
      );

      expect(processed).toBe(false);
    });
  });

  describe("markFailed", () => {
    it("marks failure only for the current valid claim", async () => {
      db.inboxEvent.updateMany.mockResolvedValue({ count: 1 });

      const failed = await repository.markFailed(
        "event-123",
        "claim-token-current",
        "Notification delivery failed",
      );

      expect(failed).toBe(true);

      const [query] = db.inboxEvent.updateMany.mock.calls[0]!;

      expect(query.where).toMatchObject({
        eventId: "event-123",
        status: "PROCESSING",
        claimToken: "claim-token-current",
        leaseExpiresAt: { gt: expect.any(Date) },
      });

      expect(query.data).toMatchObject({
        status: "FAILED",
        failureReason: "Notification delivery failed",
        claimToken: null,
        leaseExpiresAt: null,
      });
    });

    it("does not overwrite a claim owned by another worker", async () => {
      db.inboxEvent.updateMany.mockResolvedValue({ count: 0 });

      const failed = await repository.markFailed(
        "event-123",
        "claim-token-old",
        "Old worker failed",
      );

      expect(failed).toBe(false);
    });
  });
});
