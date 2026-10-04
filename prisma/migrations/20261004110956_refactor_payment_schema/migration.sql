/*
  Warnings:

  - You are about to drop the column `provider` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `providerReference` on the `Payment` table. All the data in the column will be lost.
  - You are about to drop the column `providerReference` on the `PaymentRefund` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `PaymentWebhookEvent` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[paymentId,idempotencyKey]` on the table `PaymentAttempt` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[providerRefundReference]` on the table `PaymentRefund` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[paymentId,idempotencyKey]` on the table `PaymentRefund` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[provider,eventKey]` on the table `PaymentWebhookEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `eventKey` to the `PaymentWebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payloadHash` to the `PaymentWebhookEvent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PaymentWebhookEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Payment_providerReference_key";

-- DropIndex
DROP INDEX "Payment_provider_idx";

-- DropIndex
DROP INDEX "PaymentRefund_providerReference_key";

-- DropIndex
DROP INDEX "PaymentWebhookEvent_provider_eventId_key";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "provider",
DROP COLUMN "providerReference";

-- AlterTable
ALTER TABLE "PaymentAttempt" ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "lastVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "providerMetadata" JSONB,
ADD COLUMN     "providerStatus" TEXT;

-- AlterTable
ALTER TABLE "PaymentRefund" DROP COLUMN "providerReference",
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "providerRefundReference" TEXT,
ADD COLUMN     "providerStatus" TEXT;

-- AlterTable
ALTER TABLE "PaymentWebhookEvent" DROP COLUMN "eventId",
ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "eventKey" TEXT NOT NULL,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "payloadHash" TEXT NOT NULL,
ADD COLUMN     "processingAt" TIMESTAMP(3),
ADD COLUMN     "providerEventId" TEXT,
ADD COLUMN     "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "PaymentAttempt_provider_providerReference_idx" ON "PaymentAttempt"("provider", "providerReference");

-- CreateIndex
CREATE INDEX "PaymentAttempt_lastVerifiedAt_idx" ON "PaymentAttempt"("lastVerifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_paymentId_idempotencyKey_key" ON "PaymentAttempt"("paymentId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_providerRefundReference_key" ON "PaymentRefund"("providerRefundReference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentRefund_paymentId_idempotencyKey_key" ON "PaymentRefund"("paymentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_eventType_idx" ON "PaymentWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "PaymentWebhookEvent_processedAt_idx" ON "PaymentWebhookEvent"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookEvent_provider_eventKey_key" ON "PaymentWebhookEvent"("provider", "eventKey");
