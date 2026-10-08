import type { InboxEventStatus } from "@prisma/client";

export type CreateInboxEventInput = {
  eventId: string;
  eventType: string;
};

export type UpdateInboxEventInput = {
  status: InboxEventStatus;
  failureReason?: string;
};



export type InboxRepository = { findByEventId: (eventId: string) => Promise<unknown>;

  create: (input: CreateInboxEventInput) => Promise<unknown>;

  updateStatus: (eventId: string,  input: UpdateInboxEventInput) => Promise<unknown>;

};
