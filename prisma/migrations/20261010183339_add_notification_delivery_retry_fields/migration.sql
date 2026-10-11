-- AlterTable
ALTER TABLE "NotificationDelivery" ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "nextRetryAt" TIMESTAMP(3);
