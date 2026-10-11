-- AlterTable
ALTER TABLE "NotificationDelivery" ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT;

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_nextRetryAt_createdAt_idx" ON "NotificationDelivery"("status", "nextRetryAt", "createdAt");

-- CreateIndex
CREATE INDEX "NotificationDelivery_status_leaseExpiresAt_idx" ON "NotificationDelivery"("status", "leaseExpiresAt");
