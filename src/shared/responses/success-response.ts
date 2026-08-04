import type { Response } from "express";

export function sendSuccess<T>(
  res: Response,
  options: {
    statusCode?: number;
    message: string;
    data?: T;
  },
) {
  return res.status(options.statusCode ?? 200).json({
    success: true,
    message: options.message,
    data: options.data ?? null,
  });
}