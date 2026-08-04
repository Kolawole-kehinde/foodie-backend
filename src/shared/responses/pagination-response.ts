import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  message = "Data retrieved successfully",
) {
  return res.status(200).json({
    success: true,
    message,
    data,
    meta: {
      ...meta,
      hasNextPage: meta.page < meta.totalPages,
      hasPreviousPage: meta.page > 1,
    },
  });
}