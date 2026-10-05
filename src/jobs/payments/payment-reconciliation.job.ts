import cron from "node-cron";

import { logger } from "../../config/logger.js";
import type { PaymentRepository } from "../../modules/payments/repositories/payment.repository.js";
import type { PaymentReconciliationService } from "../../modules/payments/services/payment-reconciliation.service.js";

const PAYMENT_RECONCILIATION_SCHEDULE = "* * * * *";

const STALE_PAYMENT_MINUTES = 5;

const PAYMENT_RECONCILIATION_BATCH_SIZE = 50;

type PaymentReconciliationJobDependencies = {
  paymentRepository: PaymentRepository;
  paymentReconciliationService: PaymentReconciliationService;
};

export const createPaymentReconciliationJob = ({
  paymentRepository,
  paymentReconciliationService,
}: PaymentReconciliationJobDependencies) => {
  /**
   * Prevents overlapping executions of the same job
   * within the same application process.
   */
  let isRunning = false;

  const start = () => {
    /**
     * Run the reconciliation job every minute.
     */
    cron.schedule(PAYMENT_RECONCILIATION_SCHEDULE, async () => {
      /**
       * If the previous execution has not finished,
       * skip this execution instead of running two
       * reconciliation batches at the same time.
       */
      if (isRunning) {
        logger.warn(
          "[Payments] Reconciliation job skipped because previous run is still active",
        );

        return;
      }

      isRunning = true;

      logger.info("[Payments] Reconciliation job started");

      try {
        /**
         * Only reconcile payments that have remained in
         * PROCESSING state for at least 5 minutes.
         *
         * This gives webhooks and normal payment processing
         * enough time to complete before reconciliation begins.
         */
        const staleBefore = new Date(
          Date.now() - STALE_PAYMENT_MINUTES * 60 * 1000,
        );

        /**
         * Fetch a limited number of stale payments so one
         * job execution does not attempt to process an
         * unlimited number of payments.
         */
        const payments = await paymentRepository.getPaymentsForReconciliation({
          staleBefore,
          limit: PAYMENT_RECONCILIATION_BATCH_SIZE,
        });

        let reconciledCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        /**
         * Process payments sequentially.
         *
         * This avoids sending a large number of verification
         * requests to the payment provider at once.
         */
        for (const payment of payments) {
          try {
            /**
             * The service performs the actual provider
             * verification and payment state reconciliation.
             */
            const result =
              await paymentReconciliationService.reconcilePaymentForJob({
                paymentId: payment.id,
              });

            /**
             * The payment may have already been completed
             * by a webhook or another process after it was
             * selected by the job.
             */
            if ("skipped" in result && result.skipped) {
              skippedCount++;
              continue;
            }

            reconciledCount++;

            logger.info(
              {
                paymentId: payment.id,
                previousStatus:
                  "previousStatus" in result
                    ? result.previousStatus
                    : result.status,
                status: result.status,
                changed: result.changed,
              },
              "[Payments] Payment reconciliation completed",
            );
          } catch (error) {
            /**
             * One failed payment should not stop the entire
             * batch. Log the error and continue with the
             * remaining payments.
             */
            failedCount++;

            logger.error(
              {
                err: error,
                paymentId: payment.id,
              },
              "[Payments] Payment reconciliation failed",
            );
          }
        }

        /**
         * Log a summary after the entire batch has been processed.
         */
        logger.info(
          {
            total: payments.length,
            reconciledCount,
            skippedCount,
            failedCount,
          },
          "[Payments] Reconciliation job completed",
        );
      } catch (error) {
        /**
         * Handles errors that occur while fetching the
         * reconciliation batch or other job-level failures.
         */
        logger.error(
          {
            err: error,
          },
          "[Payments] Reconciliation job failed",
        );
      } finally {
        /**
         * Always release the running flag, even when an
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
        schedule: PAYMENT_RECONCILIATION_SCHEDULE,
        staleAfterMinutes: STALE_PAYMENT_MINUTES,
        batchSize: PAYMENT_RECONCILIATION_BATCH_SIZE,
      },
      "[Payments] Reconciliation cron job started",
    );
  };

  return {
    start,
  };
};
