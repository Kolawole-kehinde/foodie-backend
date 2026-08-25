import type {Request, Response,NextFunction,} from "express";
import { createRateLimitService } from "./rate-limit.service.js";
import { RateLimitError } from "../errors/RateLimitError.js";
import type { RateLimitRule,} from "./rate-limit.types.js";



const rateLimitService = createRateLimitService();

type RateLimitMiddlewareOptions = {
  rules: (req: Request) => RateLimitRule[];
};

export const rateLimit = ({rules,}: RateLimitMiddlewareOptions) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    
    try {
      const rateLimitRules = rules(req);

      const results = await Promise.all(
        rateLimitRules.map((rule) =>
          rateLimitService.check(rule)
        )
      );

      const blockedRules = results.filter(
        (result) => !result.allowed
      );

      /*
       * Use the most restrictive result
       * for the response headers.
       */
      const mostRestrictive =
        results.reduce((current, candidate) =>
          candidate.remaining < current.remaining
            ? candidate
            : current
        );

      res.setHeader(
        "X-RateLimit-Limit",
        mostRestrictive.limit
      );

      res.setHeader(
        "X-RateLimit-Remaining",
        mostRestrictive.remaining
      );

      res.setHeader(
        "X-RateLimit-Reset",
        Math.ceil(
          mostRestrictive.resetAt / 1000
        )
      );

      if (blockedRules.length > 0) {
        /*
         * Find the rule that requires
         * the longest wait.
         */
        const resetAt = Math.max(
          ...blockedRules.map(
            (result) => result.resetAt
          )
        );

        const retryAfter = Math.max(
          Math.ceil(
            (resetAt - Date.now()) / 1000
          ),
          1
        );

        res.setHeader(
          "Retry-After",
          retryAfter
        );

        throw new RateLimitError(
          "Too many requests. Please try again later."
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};