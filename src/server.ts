import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";



const app = createApp()

app.listen(env.port, () => {
  logger.info(`Server is running on port ${env.port} in ${env.nodeEnv} mode`)
})