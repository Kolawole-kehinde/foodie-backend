-- CreateEnum
CREATE TYPE "MediaUploadStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('AVATAR', 'PRODUCT_IMAGE');

-- CreateTable
CREATE TABLE "MediaUpload" (
    "id" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "status" "MediaUploadStatus" NOT NULL DEFAULT 'PENDING',
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_objectKey_key" ON "MediaUpload"("objectKey");

-- CreateIndex
CREATE INDEX "MediaUpload_uploadedById_idx" ON "MediaUpload"("uploadedById");

-- CreateIndex
CREATE INDEX "MediaUpload_status_idx" ON "MediaUpload"("status");

-- CreateIndex
CREATE INDEX "MediaUpload_expiresAt_idx" ON "MediaUpload"("expiresAt");

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
