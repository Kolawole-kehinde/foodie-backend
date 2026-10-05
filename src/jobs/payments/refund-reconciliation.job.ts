import cron from "node-cron";

import { logger } from "../../config/logger.js";
import type { PaymentRefundRepository } from "../../modules/payments/repositories/payment-refund.repository.js";
import type { PaymentRefundService } from "../../modules/payments/services/payment-refund.service.js";

const REFUND_RECONCILIATION_SCHEDULE = "* * * * *";

const STALE_REFUND_MINUTES = 5;

const REFUND_RECONCILIATION_BATCH_SIZE = 50;

type RefundReconciliationJobDependencies = {
  paymentRefundRepository: PaymentRefundRepository;
  paymentRefundService: PaymentRefundService;
};

export const createRefundReconciliationJob = ({
  paymentRefundRepository,
  paymentRefundService,
}: RefundReconciliationJobDependencies) => {
  /**
   * Prevents overlapping executions of the same job
   * within the same application process.
   */
  let isRunning = false;

  const start = () => {
    /**
     * Run the refund reconciliation job every minute.
     */
    cron.schedule(REFUND_RECONCILIATION_SCHEDULE, async () => {
      /**
       * If the previous execution is still running,
       * skip this execution.
       */
      if (isRunning) {
        logger.warn(
          "[Payments] Refund reconciliation job skipped because previous run is still active",
        );

        return;
      }

      isRunning = true;

      logger.info("[Payments] Refund reconciliation job started");

      try {
        /**
         * Only reconcile refunds that have remained in
         * PROCESSING state for at least 5 minutes.
         */
        const staleBefore = new Date(
          Date.now() - STALE_REFUND_MINUTES * 60 * 1000,
        );

        /**
         * Fetch a limited number of stale refunds so one
         * execution does not process an unlimited number
         * of refunds.
         */
        const refunds =
          await paymentRefundRepository.getRefundsForReconciliation({
            staleBefore,
            limit: REFUND_RECONCILIATION_BATCH_SIZE,
          });

        let reconciledCount = 0;
        let failedCount = 0;

        /**
         * Process refunds sequentially to avoid sending
         * too many verification requests to the provider
         * at the same time.
         */
        for (const refund of refunds) {
          try {
            /**
             * The service performs provider verification
             * and updates the refund/payment state when
             * necessary.
             */
            const result = await paymentRefundService.reconcileRefund({
              refundId: refund.id,
            });

            reconciledCount++;

            logger.info(
              {
                refundId: refund.id,
                status: result.status,
              },
              "[Payments] Refund reconciliation completed",
            );
          } catch (error) {
            /**
             * One failed refund should not stop the rest
             * of the batch from being processed.
             */
            failedCount++;

            logger.error(
              {
                err: error,
                refundId: refund.id,
              },
              "[Payments] Refund reconciliation failed",
            );
          }
        }

        /**
         * Log a summary after processing the batch.
         */
        logger.info(
          {
            total: refunds.length,
            reconciledCount,
            failedCount,
          },
          "[Payments] Refund reconciliation job completed",
        );
      } catch (error) {
        /**
         * Handles job-level failures such as failure to
         * retrieve refunds from the database.
         */
        logger.error(
          {
            err: error,
          },
          "[Payments] Refund reconciliation job failed",
        );
      } finally {
        /**
         * Always release the running flag, even if an
         * unexpected error occurs.
         */
        isRunning = false;
      }
    });

    /**
     * Log the job configuration when the cron job starts.
     */
    logger.info(
      {
        schedule: REFUND_RECONCILIATION_SCHEDULE,
        staleAfterMinutes: STALE_REFUND_MINUTES,
        batchSize: REFUND_RECONCILIATION_BATCH_SIZE,
      },
      "[Payments] Refund reconciliation cron job started",
    );
  };

  return {
    start,
  };
};
