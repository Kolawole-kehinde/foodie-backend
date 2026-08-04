import type { Response } from "express";

export function sendNoContent(res: Response) {
  return res.sendStatus(204);
}