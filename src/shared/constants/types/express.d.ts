import type { RequestContext } from "@/shared/context";

declare global {
  namespace Express {
    interface Request {
      context: RequestContext;
    }
  }
}

export {};