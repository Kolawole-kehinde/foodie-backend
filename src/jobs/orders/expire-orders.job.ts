import cron from "node-cron";
import type { OrderService } from "../../modules/order/services/order.service.js";
import { logger } from "../../config/logger.js";

const EXPIRE_ORDERS_SCHEDULE = "* * * * *";

type ExpireOrdersJobDependencies = {
  orderService: OrderService;
};


export const createExpireOrdersJob = ({
  orderService,
}: ExpireOrdersJobDependencies) => {
  const start = () => {
    cron.schedule(EXPIRE_ORDERS_SCHEDULE, async () => {
      logger.info("[Orders] Expire reservations job started");

      try {
        const { expiredCount } = await orderService.expireReservations();

        logger.info(
          { expiredCount },
          "[Orders] Expire reservations job completed",
        );
      } catch (error) {
        logger.error(
          {
            err: error,
          },
          "[Orders] Expire reservations job failed",
        );
      }
    });

    logger.info(
      {
        schedule: EXPIRE_ORDERS_SCHEDULE,
      },
      "[Orders] Expire reservations cron job started",
    );
  };

  return {
    start,
  };
};

export type ExpireOrdersJob = ReturnType<typeof createExpireOrdersJob>;
