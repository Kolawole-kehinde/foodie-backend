-- AlterTable
ALTER TABLE "InboxEvent" ADD COLUMN     "claimToken" TEXT,
ADD COLUMN     "leaseExpiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InboxEvent_status_leaseExpiresAt_idx" ON "InboxEvent"("status", "leaseExpiresAt");
