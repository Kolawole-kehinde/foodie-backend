import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.logger.LEVEL,
  ...(env.app.IS_PRODUCTION
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      }),
});