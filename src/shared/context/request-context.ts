import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

export const requestContext: RequestHandler = (req, _res, next) => {
  req.context = {
    requestId: randomUUID(),
    startedAt: Date.now(),
    ipAddress: req.ip ?? "unknown",
    userAgent: req.get("user-agent") ?? undefined,
  };

  next();
};